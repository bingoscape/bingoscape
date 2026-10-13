import "server-only"

import { and, asc, count, eq, inArray, sql } from "drizzle-orm"

import {
  can,
  buildEventActor,
  evaluatePolicy,
  type EventActor,
  type PolicyResource,
} from "@/lib/authz/policy"
import type { Permission } from "@/lib/authz/permissions"
import { isEventRole } from "@/lib/authz/roles"
import { isClanRole, validateRoleChange } from "@/lib/clan"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  clanMembers,
  clans,
  eventBuyIns,
  eventDonations,
  eventParticipants,
  events,
  roleChangeLog,
  teamMembers,
  teams,
  type RoleChangeAction,
  type RoleChangeSource,
} from "@/server/db/schema"
import { recordEventAudit } from "./audit-log"

/**
 * The only place that writes `event_participants` and `clan_members`.
 *
 * Every operation runs in one `db.transaction()` (or in the caller's, when a
 * `tx` is passed), locks the parent row (`SELECT ... FOR UPDATE` on the Event
 * or Clan) so concurrent changes of one Event/Clan are serialised, checks the
 * invariants against rows read under that lock, writes the membership and
 * appends the `role_change_log` row. Refusals do not throw: they come back as
 * `{ success: false, error, code }` and, for authorization and invariant
 * refusals, leave an `event_audit_log` row.
 *
 * Invariants
 * - An Event always keeps at least one admin; a Clan too.
 * - The Event owner (`events.creator_id`) and the Clan owner (`clans.owner_id`)
 *   can be neither demoted nor removed. Ownership is handed over with
 *   `transferOwnership()` first.
 * - Nobody grants or adds a role above their own (policy from `@/lib/authz`).
 * - Granting the Event admin role is owner-only, as are deleting the Event and
 *   transferring ownership. An Event whose creator account is gone has no
 *   creator: its oldest admin acts as the owner for these actions (the owner
 *   protections above then do not apply, the last-admin rule still does).
 *
 * The database trigger from migration 0039 is the safety net for writes that
 * bypass this module: it logs them with source `trigger`. This module sets the
 * transaction-local `app.audit_source` so the trigger stays quiet for writes
 * that are already logged here (no double logging).
 *
 * Not a "use server" module: nothing here is callable from the browser.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export type MembershipScope = "event" | "clan"

/**
 * Who performs the change.
 * - `user`: a signed-in user; the policy decides what they may do.
 * - `self`: the subject acting on their own membership (joining through an
 *   invite, leaving); never allowed to take a role above the lowest one.
 * - `system`: trusted code that already authenticated the caller (creating an
 *   Event or Clan, super-admin actions). No policy check, invariants apply.
 */
export type MembershipActor =
  | { kind: "user"; userId: string }
  | { kind: "self"; userId: string }
  | { kind: "system"; userId?: string | null }

export type MembershipErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "NOT_A_MEMBER"
  | "ALREADY_MEMBER"
  | "OWNER_ONLY"
  | "ROLE_CEILING"
  | "OWNER_PROTECTED"
  | "LAST_ADMIN"
  | "INVALID"
  | "FAILED"

export type MembershipResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string; code: MembershipErrorCode }

/** What a successful operation reports; `changed` is false for a no-op. */
export interface MembershipChange {
  changed: boolean
  oldRole: string | null
  newRole: string | null
}

interface BaseInput {
  scope: MembershipScope
  /** The Event or Clan. */
  parentId: string
  /** The member the change is about. */
  userId: string
  actor: MembershipActor
  /** Ledger source; defaults to `system` for system actors, else `app`. */
  source?: Exclude<RoleChangeSource, "trigger" | "migration">
  reason?: string
  requestId?: string
  /** Run inside this transaction instead of opening one. */
  tx?: Tx
}

export type ChangeRoleInput = BaseInput & { newRole: string }
export type AddMemberInput = BaseInput & {
  role: string
  /** Clans only: make this the user's main Clan. */
  isMain?: boolean
}
export type RemoveMemberInput = BaseInput
export type TransferOwnershipInput = Omit<BaseInput, "userId"> & {
  newOwnerId: string
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

const MESSAGES = {
  UNAUTHENTICATED: "Unauthorized",
  FORBIDDEN: "Forbidden: insufficient permissions",
} as const

function failure(
  code: MembershipErrorCode,
  error: string
): { success: false; error: string; code: MembershipErrorCode } {
  return { success: false, error, code }
}

type Failure = ReturnType<typeof failure>

interface OpContext {
  tx: Tx
  scope: MembershipScope
  parentId: string
  actorUserId: string | null
  source: RoleChangeSource
  reason: string | null
  requestId: string | null
}

function actorUserIdOf(actor: MembershipActor): string | null {
  return actor.userId ?? null
}

/**
 * Runs `fn` in a transaction with the audit source set, so the trigger leaves
 * the writes of this operation alone. The setting is reset afterwards: when
 * the caller's transaction goes on, later writes outside this module are still
 * caught by the trigger.
 */
async function inTransaction<T>(
  input: Pick<BaseInput, "tx" | "source" | "actor" | "reason" | "requestId">,
  scope: MembershipScope,
  parentId: string,
  fn: (ctx: OpContext) => Promise<T>
): Promise<T> {
  const source: RoleChangeSource =
    input.source ?? (input.actor.kind === "system" ? "system" : "app")
  const run = async (tx: Tx) => {
    await tx.execute(
      sql`select set_config('app.audit_source', ${source}, true)`
    )
    try {
      return await fn({
        tx,
        scope,
        parentId,
        actorUserId: actorUserIdOf(input.actor),
        source,
        reason: input.reason ?? null,
        requestId: input.requestId ?? null,
      })
    } finally {
      await tx.execute(sql`select set_config('app.audit_source', '', true)`)
    }
  }
  return input.tx ? run(input.tx) : db.transaction(run)
}

async function appendLedger(
  ctx: OpContext,
  entry: {
    subjectUserId: string
    action: RoleChangeAction
    oldRole: string | null
    newRole: string | null
  }
) {
  await ctx.tx.insert(roleChangeLog).values({
    scopeType: ctx.scope,
    scopeId: ctx.parentId,
    subjectUserId: entry.subjectUserId,
    actorUserId: ctx.actorUserId,
    action: entry.action,
    oldRole: entry.oldRole,
    newRole: entry.newRole,
    source: ctx.source,
    reason: ctx.reason,
    requestId: ctx.requestId,
  })
}

/** Writes the audit row for a refusal and returns the failure. */
async function deny(
  ctx: OpContext,
  op: "add" | "change" | "remove" | "transfer_ownership",
  code: MembershipErrorCode,
  error: string,
  detail: {
    subjectUserId: string
    oldRole?: string | null
    newRole?: string | null
    permission?: Permission
  }
): Promise<Failure> {
  try {
    await recordEventAudit(ctx.tx, {
      eventId: ctx.scope === "event" ? ctx.parentId : null,
      actorUserId: ctx.actorUserId,
      action: `${ctx.scope}.member.${op}`,
      permission: detail.permission ?? null,
      targetType: ctx.scope === "event" ? "participant" : "clan_member",
      targetId:
        ctx.scope === "event"
          ? detail.subjectUserId
          : `${ctx.parentId}:${detail.subjectUserId}`,
      outcome: "denied",
      before: { role: detail.oldRole ?? null },
      after: { role: detail.newRole ?? null },
      reason: `${code}: ${error}`,
      requestId: ctx.requestId,
    })
  } catch (auditError) {
    // A failing audit row must not hide the refusal.
    logger.error({ error: auditError }, "Could not record membership denial")
  }
  return failure(code, error)
}

/** Why the policy said no, as a code and message. */
function explainDenial(
  actor: EventActor,
  permission: Permission,
  resource: PolicyResource,
  ceilingMessage: string
): Failure {
  const noOwnerOnly = new Set<Permission>()
  if (evaluatePolicy(actor, permission, resource, noOwnerOnly)) {
    return failure(
      "OWNER_ONLY",
      resource.newRole === "admin"
        ? "Only the event owner can grant the admin role"
        : "Only the event owner can do this"
    )
  }
  if (evaluatePolicy(actor, permission, {}, noOwnerOnly)) {
    return failure("ROLE_CEILING", ceilingMessage)
  }
  return failure("FORBIDDEN", MESSAGES.FORBIDDEN)
}

// ---------------------------------------------------------------------------
// Event
// ---------------------------------------------------------------------------

interface EventState {
  creatorId: string | null
  /** The creator, or the oldest admin when the creator account is gone. */
  ownerId: string | null
}

async function lockEvent(
  ctx: OpContext,
  mode: "update" | "share"
): Promise<EventState | null> {
  const [event] = await ctx.tx
    .select({ creatorId: events.creatorId })
    .from(events)
    .where(eq(events.id, ctx.parentId))
    .for(mode)
    .limit(1)
  if (!event) return null
  let ownerId = event.creatorId
  if (ownerId === null) {
    const [oldest] = await ctx.tx
      .select({ userId: eventParticipants.userId })
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, ctx.parentId),
          eq(eventParticipants.role, "admin")
        )
      )
      .orderBy(asc(eventParticipants.createdAt), asc(eventParticipants.id))
      .limit(1)
    ownerId = oldest?.userId ?? null
  }
  return { creatorId: event.creatorId, ownerId }
}

async function eventParticipant(ctx: OpContext, userId: string) {
  const [row] = await ctx.tx
    .select({
      id: eventParticipants.id,
      role: eventParticipants.role,
    })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, ctx.parentId),
        eq(eventParticipants.userId, userId)
      )
    )
    .limit(1)
  return row ?? null
}

async function otherEventAdmins(ctx: OpContext, userId: string) {
  const [row] = await ctx.tx
    .select({ total: count() })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, ctx.parentId),
        eq(eventParticipants.role, "admin"),
        sql`${eventParticipants.userId} <> ${userId}`
      )
    )
  return row?.total ?? 0
}

/** The acting user as the policy sees them, read under the Event lock. */
async function eventActorOf(
  ctx: OpContext,
  actor: MembershipActor,
  state: EventState
): Promise<EventActor | null> {
  if (actor.kind === "system") return null
  const participant = await eventParticipant(ctx, actor.userId)
  return buildEventActor({
    userId: actor.userId,
    eventId: ctx.parentId,
    creatorId: state.creatorId,
    ownerFallbackId: state.ownerId,
    participantRole: participant?.role ?? null,
  })
}

async function eventChangeRole(
  input: ChangeRoleInput
): Promise<MembershipResult<MembershipChange>> {
  const newRole = input.newRole
  if (!isEventRole(newRole)) return failure("INVALID", "Unknown role")

  return inTransaction(input, "event", input.parentId, async (ctx) => {
    const state = await lockEvent(ctx, "update")
    if (!state) return failure("NOT_FOUND", "Event not found")
    const target = await eventParticipant(ctx, input.userId)
    if (!target) return failure("NOT_FOUND", "Participant not found")

    const subject = {
      subjectUserId: input.userId,
      oldRole: target.role,
      newRole,
      permission: "participant:set-role" as const,
    }
    const actor = await eventActorOf(ctx, input.actor, state)
    if (input.actor.kind === "self") {
      return deny(ctx, "change", "FORBIDDEN", MESSAGES.FORBIDDEN, subject)
    }
    if (actor) {
      const resource = { targetRole: target.role, newRole }
      if (!can(actor, "participant:set-role", resource)) {
        const denial = explainDenial(
          actor,
          "participant:set-role",
          resource,
          "You can't grant a role above your own"
        )
        return deny(ctx, "change", denial.code, denial.error, subject)
      }
    }

    if (target.role === newRole) {
      return {
        success: true as const,
        changed: false,
        oldRole: target.role,
        newRole,
      }
    }
    if (state.creatorId === input.userId && newRole !== "admin") {
      return deny(
        ctx,
        "change",
        "OWNER_PROTECTED",
        "The event creator can't be demoted from admin",
        subject
      )
    }
    if (
      target.role === "admin" &&
      newRole !== "admin" &&
      (await otherEventAdmins(ctx, input.userId)) === 0
    ) {
      return deny(
        ctx,
        "change",
        "LAST_ADMIN",
        "An event needs at least one admin",
        subject
      )
    }

    await ctx.tx
      .update(eventParticipants)
      .set({ role: newRole, updatedAt: new Date() })
      .where(eq(eventParticipants.id, target.id))
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "change",
      oldRole: target.role,
      newRole,
    })
    if (target.role === "admin" || newRole === "admin") {
      await recordEventAudit(ctx.tx, {
        eventId: ctx.parentId,
        actorUserId: ctx.actorUserId,
        action: "event.member.change",
        permission: "participant:set-role",
        targetType: "participant",
        targetId: input.userId,
        outcome: "success",
        before: { role: target.role },
        after: { role: newRole },
        reason: ctx.reason,
        requestId: ctx.requestId,
      })
    }
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole,
    }
  })
}

async function eventAddMember(
  input: AddMemberInput
): Promise<MembershipResult<MembershipChange>> {
  const role = input.role
  if (!isEventRole(role)) return failure("INVALID", "Unknown role")

  return inTransaction(input, "event", input.parentId, async (ctx) => {
    const state = await lockEvent(ctx, "share")
    if (!state) return failure("NOT_FOUND", "Event not found")

    const subject = {
      subjectUserId: input.userId,
      oldRole: null,
      newRole: role,
      permission: "participant:add" as const,
    }
    if (input.actor.kind === "self") {
      // Joining on one's own never yields more than a plain participant.
      if (input.actor.userId !== input.userId || role !== "participant") {
        return deny(
          ctx,
          "add",
          "ROLE_CEILING",
          "You can only join as a participant",
          subject
        )
      }
    } else if (input.actor.kind === "user") {
      const actor = await eventActorOf(ctx, input.actor, state)
      const resource = { newRole: role }
      if (!actor || !can(actor, "participant:add", resource)) {
        const denial = actor
          ? explainDenial(
              actor,
              "participant:add",
              resource,
              "You can't add a participant with a role above your own"
            )
          : failure("FORBIDDEN", MESSAGES.FORBIDDEN)
        return deny(ctx, "add", denial.code, denial.error, subject)
      }
    }

    const inserted = await ctx.tx
      .insert(eventParticipants)
      .values({ eventId: ctx.parentId, userId: input.userId, role })
      .onConflictDoNothing({
        target: [eventParticipants.eventId, eventParticipants.userId],
      })
      .returning({ id: eventParticipants.id })
    if (inserted.length === 0) {
      return failure("ALREADY_MEMBER", "Already a participant in this event")
    }
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "add",
      oldRole: null,
      newRole: role,
    })
    if (role === "admin") {
      await recordEventAudit(ctx.tx, {
        eventId: ctx.parentId,
        actorUserId: ctx.actorUserId,
        action: "event.member.add",
        permission: "participant:add",
        targetType: "participant",
        targetId: input.userId,
        outcome: "success",
        before: null,
        after: { role },
        reason: ctx.reason,
        requestId: ctx.requestId,
      })
    }
    return {
      success: true as const,
      changed: true,
      oldRole: null,
      newRole: role,
    }
  })
}

async function eventRemoveMember(
  input: RemoveMemberInput
): Promise<MembershipResult<MembershipChange>> {
  return inTransaction(input, "event", input.parentId, async (ctx) => {
    const state = await lockEvent(ctx, "update")
    if (!state) return failure("NOT_FOUND", "Event not found")
    const target = await eventParticipant(ctx, input.userId)
    if (!target) return failure("NOT_FOUND", "Participant not found")

    const subject = {
      subjectUserId: input.userId,
      oldRole: target.role,
      newRole: null,
      permission: "participant:remove" as const,
    }
    if (input.actor.kind === "self") {
      if (input.actor.userId !== input.userId) {
        return deny(ctx, "remove", "FORBIDDEN", MESSAGES.FORBIDDEN, subject)
      }
    } else if (input.actor.kind === "user") {
      const actor = await eventActorOf(ctx, input.actor, state)
      const resource = { targetRole: target.role }
      if (!actor || !can(actor, "participant:remove", resource)) {
        const denial = actor
          ? explainDenial(
              actor,
              "participant:remove",
              resource,
              "Only admins can remove other admins"
            )
          : failure("FORBIDDEN", MESSAGES.FORBIDDEN)
        return deny(ctx, "remove", denial.code, denial.error, subject)
      }
    }

    if (state.creatorId === input.userId) {
      return deny(
        ctx,
        "remove",
        "OWNER_PROTECTED",
        "The event creator can't be removed. Transfer ownership first.",
        subject
      )
    }
    if (
      target.role === "admin" &&
      (await otherEventAdmins(ctx, input.userId)) === 0
    ) {
      return deny(
        ctx,
        "remove",
        "LAST_ADMIN",
        "An event needs at least one admin",
        subject
      )
    }

    // The member's Team places, buy-ins and donations go with the membership.
    const eventTeamIds = ctx.tx
      .select({ id: teams.id })
      .from(teams)
      .where(eq(teams.eventId, ctx.parentId))
    await ctx.tx
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.userId, input.userId),
          inArray(teamMembers.teamId, eventTeamIds)
        )
      )
    await ctx.tx
      .delete(eventBuyIns)
      .where(eq(eventBuyIns.eventParticipantId, target.id))
    await ctx.tx
      .delete(eventDonations)
      .where(eq(eventDonations.eventParticipantId, target.id))
    await ctx.tx
      .delete(eventParticipants)
      .where(eq(eventParticipants.id, target.id))
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "remove",
      oldRole: target.role,
      newRole: null,
    })
    if (target.role === "admin") {
      await recordEventAudit(ctx.tx, {
        eventId: ctx.parentId,
        actorUserId: ctx.actorUserId,
        action: "event.member.remove",
        permission: "participant:remove",
        targetType: "participant",
        targetId: input.userId,
        outcome: "success",
        before: { role: target.role },
        after: null,
        reason: ctx.reason,
        requestId: ctx.requestId,
      })
    }
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole: null,
    }
  })
}

async function eventTransferOwnership(
  input: TransferOwnershipInput
): Promise<
  MembershipResult<MembershipChange & { previousOwnerId: string | null }>
> {
  return inTransaction(input, "event", input.parentId, async (ctx) => {
    const state = await lockEvent(ctx, "update")
    if (!state) return failure("NOT_FOUND", "Event not found")

    const target = await eventParticipant(ctx, input.newOwnerId)
    if (!target) {
      return failure(
        "NOT_A_MEMBER",
        "The new owner must be a participant of the event"
      )
    }
    const subject = {
      subjectUserId: input.newOwnerId,
      oldRole: target.role,
      newRole: "admin",
      permission: "event:transfer-ownership" as const,
    }
    if (input.actor.kind === "self") {
      return deny(
        ctx,
        "transfer_ownership",
        "FORBIDDEN",
        MESSAGES.FORBIDDEN,
        subject
      )
    }
    const actor = await eventActorOf(ctx, input.actor, state)
    if (actor && !can(actor, "event:transfer-ownership")) {
      const denial = explainDenial(
        actor,
        "event:transfer-ownership",
        {},
        MESSAGES.FORBIDDEN
      )
      return deny(ctx, "transfer_ownership", denial.code, denial.error, subject)
    }

    const previousOwnerId = state.ownerId
    if (state.creatorId === input.newOwnerId) {
      return {
        success: true as const,
        changed: false,
        oldRole: target.role,
        newRole: target.role,
        previousOwnerId,
      }
    }

    await ctx.tx
      .update(events)
      .set({ creatorId: input.newOwnerId, updatedAt: new Date() })
      .where(eq(events.id, ctx.parentId))
    // The owner is an admin; the previous owner keeps their admin role.
    if (target.role !== "admin") {
      await ctx.tx
        .update(eventParticipants)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(eventParticipants.id, target.id))
    }
    await appendLedger(ctx, {
      subjectUserId: input.newOwnerId,
      action: "transfer_ownership",
      oldRole: target.role,
      newRole: "admin",
    })
    await recordEventAudit(ctx.tx, {
      eventId: ctx.parentId,
      actorUserId: ctx.actorUserId,
      action: "event.transfer_ownership",
      permission: "event:transfer-ownership",
      targetType: "event",
      targetId: ctx.parentId,
      outcome: "success",
      before: { ownerId: previousOwnerId, creatorId: state.creatorId },
      after: { ownerId: input.newOwnerId, creatorId: input.newOwnerId },
      reason: ctx.reason,
      requestId: ctx.requestId,
    })
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole: "admin",
      previousOwnerId,
    }
  })
}

// ---------------------------------------------------------------------------
// Clan
// ---------------------------------------------------------------------------

async function lockClan(ctx: OpContext) {
  const [clan] = await ctx.tx
    .select({ ownerId: clans.ownerId, name: clans.name })
    .from(clans)
    .where(eq(clans.id, ctx.parentId))
    .for("update")
    .limit(1)
  return clan ?? null
}

async function clanMember(ctx: OpContext, userId: string) {
  const [row] = await ctx.tx
    .select({ id: clanMembers.id, role: clanMembers.role })
    .from(clanMembers)
    .where(
      and(eq(clanMembers.clanId, ctx.parentId), eq(clanMembers.userId, userId))
    )
    .limit(1)
  return row ?? null
}

async function clanAdminCount(ctx: OpContext) {
  const [row] = await ctx.tx
    .select({ total: count() })
    .from(clanMembers)
    .where(
      and(eq(clanMembers.clanId, ctx.parentId), eq(clanMembers.role, "admin"))
    )
  return row?.total ?? 0
}

async function clanChangeRole(
  input: ChangeRoleInput
): Promise<MembershipResult<MembershipChange>> {
  const newRole = input.newRole
  if (!isClanRole(newRole)) return failure("INVALID", "Unknown role")

  return inTransaction(input, "clan", input.parentId, async (ctx) => {
    const clan = await lockClan(ctx)
    if (!clan) return failure("NOT_FOUND", "Clan not found")
    const target = await clanMember(ctx, input.userId)
    const actorMember =
      input.actor.kind === "system"
        ? null
        : await clanMember(ctx, input.actor.userId)

    const verdict = validateRoleChange({
      actorId: actorUserIdOf(input.actor) ?? "",
      // Trusted callers (super-admin) act with the highest clan role.
      actorRole: input.actor.kind === "system" ? "admin" : actorMember?.role,
      targetId: input.userId,
      targetRole: target?.role,
      newRole,
      ownerId: clan.ownerId,
      adminCount: await clanAdminCount(ctx),
    })
    const subject = {
      subjectUserId: input.userId,
      oldRole: target?.role ?? null,
      newRole,
    }
    if (!verdict.ok) {
      if (verdict.code === "NOT_A_MEMBER") {
        return failure("NOT_A_MEMBER", verdict.error)
      }
      return deny(ctx, "change", verdict.code, verdict.error, subject)
    }
    if (!target)
      return failure("NOT_A_MEMBER", "That player is not a member of this clan")
    if (target.role === newRole) {
      return {
        success: true as const,
        changed: false,
        oldRole: target.role,
        newRole,
      }
    }

    await ctx.tx
      .update(clanMembers)
      .set({ role: newRole })
      .where(eq(clanMembers.id, target.id))
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "change",
      oldRole: target.role,
      newRole,
    })
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole,
    }
  })
}

async function clanAddMember(
  input: AddMemberInput
): Promise<MembershipResult<MembershipChange>> {
  const role = input.role
  if (!isClanRole(role)) return failure("INVALID", "Unknown role")

  return inTransaction(input, "clan", input.parentId, async (ctx) => {
    const clan = await lockClan(ctx)
    if (!clan) return failure("NOT_FOUND", "Clan not found")

    const subject = {
      subjectUserId: input.userId,
      oldRole: null,
      newRole: role,
    }
    if (input.actor.kind === "self") {
      if (
        input.actor.userId !== input.userId ||
        (role !== "member" && role !== "guest")
      ) {
        return deny(
          ctx,
          "add",
          "ROLE_CEILING",
          "You can only join as a member",
          subject
        )
      }
    } else if (input.actor.kind === "user") {
      const actorMember = await clanMember(ctx, input.actor.userId)
      if (actorMember?.role !== "admin") {
        return deny(
          ctx,
          "add",
          "FORBIDDEN",
          "Only clan admins can add members",
          subject
        )
      }
    }

    const inserted = await ctx.tx
      .insert(clanMembers)
      .values({
        clanId: ctx.parentId,
        userId: input.userId,
        role,
        isMain: input.isMain ?? false,
      })
      .onConflictDoNothing({
        target: [clanMembers.clanId, clanMembers.userId],
      })
      .returning({ id: clanMembers.id })
    if (inserted.length === 0) {
      return failure("ALREADY_MEMBER", "Already a member of this clan")
    }
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "add",
      oldRole: null,
      newRole: role,
    })
    return {
      success: true as const,
      changed: true,
      oldRole: null,
      newRole: role,
    }
  })
}

async function clanRemoveMember(
  input: RemoveMemberInput
): Promise<MembershipResult<MembershipChange>> {
  return inTransaction(input, "clan", input.parentId, async (ctx) => {
    const clan = await lockClan(ctx)
    if (!clan) return failure("NOT_FOUND", "Clan not found")
    const target = await clanMember(ctx, input.userId)
    if (!target) return failure("NOT_A_MEMBER", "Not a member of this clan")

    const subject = {
      subjectUserId: input.userId,
      oldRole: target.role,
      newRole: null,
    }
    if (input.actor.kind === "self" && input.actor.userId !== input.userId) {
      return deny(ctx, "remove", "FORBIDDEN", MESSAGES.FORBIDDEN, subject)
    }
    if (input.actor.kind === "user" && input.actor.userId !== input.userId) {
      const actorMember = await clanMember(ctx, input.actor.userId)
      if (actorMember?.role !== "admin") {
        return deny(
          ctx,
          "remove",
          "FORBIDDEN",
          "Only clan admins can remove members",
          subject
        )
      }
    }

    if (clan.ownerId === input.userId) {
      return deny(
        ctx,
        "remove",
        "OWNER_PROTECTED",
        input.actor.kind === "self"
          ? "The clan owner can't leave the clan"
          : "The clan owner can't be removed. Transfer ownership first.",
        subject
      )
    }
    if (target.role === "admin" && (await clanAdminCount(ctx)) <= 1) {
      return deny(
        ctx,
        "remove",
        "LAST_ADMIN",
        "A clan needs at least one admin",
        subject
      )
    }

    await ctx.tx.delete(clanMembers).where(eq(clanMembers.id, target.id))
    await appendLedger(ctx, {
      subjectUserId: input.userId,
      action: "remove",
      oldRole: target.role,
      newRole: null,
    })
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole: null,
    }
  })
}

async function clanTransferOwnership(
  input: TransferOwnershipInput
): Promise<
  MembershipResult<MembershipChange & { previousOwnerId: string | null }>
> {
  return inTransaction(input, "clan", input.parentId, async (ctx) => {
    const clan = await lockClan(ctx)
    if (!clan) return failure("NOT_FOUND", "Clan not found")
    const target = await clanMember(ctx, input.newOwnerId)
    if (!target) {
      return failure(
        "NOT_A_MEMBER",
        "The new owner must be a member of the clan"
      )
    }
    const subject = {
      subjectUserId: input.newOwnerId,
      oldRole: target.role,
      newRole: "admin",
    }
    if (input.actor.kind !== "system" && clan.ownerId !== input.actor.userId) {
      return deny(
        ctx,
        "transfer_ownership",
        "OWNER_ONLY",
        "Only the clan owner can transfer ownership",
        subject
      )
    }

    if (clan.ownerId === input.newOwnerId) {
      return {
        success: true as const,
        changed: false,
        oldRole: target.role,
        newRole: target.role,
        previousOwnerId: clan.ownerId,
      }
    }
    await ctx.tx
      .update(clans)
      .set({ ownerId: input.newOwnerId, updatedAt: new Date() })
      .where(eq(clans.id, ctx.parentId))
    if (target.role !== "admin") {
      await ctx.tx
        .update(clanMembers)
        .set({ role: "admin" })
        .where(eq(clanMembers.id, target.id))
    }
    await appendLedger(ctx, {
      subjectUserId: input.newOwnerId,
      action: "transfer_ownership",
      oldRole: target.role,
      newRole: "admin",
    })
    return {
      success: true as const,
      changed: true,
      oldRole: target.role,
      newRole: "admin",
      previousOwnerId: clan.ownerId,
    }
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

async function guarded<T extends object>(
  input: { scope: MembershipScope; parentId: string; tx?: Tx },
  op: string,
  run: () => Promise<MembershipResult<T>>
): Promise<MembershipResult<T>> {
  try {
    return await run()
  } catch (error) {
    logger.error(
      { error, op, scope: input.scope, parentId: input.parentId },
      "Membership change failed"
    )
    // Inside the caller's transaction a failed statement has already aborted
    // it: let the caller roll back instead of continuing on a dead transaction.
    if (input.tx) throw error
    return failure("FAILED", "Failed to change the membership")
  }
}

/** Sets the role of an existing member of an Event or Clan. */
export function changeRole(
  input: ChangeRoleInput
): Promise<MembershipResult<MembershipChange>> {
  return guarded(input, "changeRole", () =>
    input.scope === "event" ? eventChangeRole(input) : clanChangeRole(input)
  )
}

/** Adds a member (participant of an Event, member of a Clan). */
export function addMember(
  input: AddMemberInput
): Promise<MembershipResult<MembershipChange>> {
  return guarded(input, "addMember", () =>
    input.scope === "event" ? eventAddMember(input) : clanAddMember(input)
  )
}

/**
 * Removes a member. For an Event this also removes the member's Team places,
 * buy-ins and donations.
 */
export function removeMember(
  input: RemoveMemberInput
): Promise<MembershipResult<MembershipChange>> {
  return guarded(input, "removeMember", () =>
    input.scope === "event" ? eventRemoveMember(input) : clanRemoveMember(input)
  )
}

/**
 * Makes an existing member the owner (`events.creator_id` /
 * `clans.owner_id`) and an admin. The previous owner stays an admin and can be
 * demoted afterwards. Owner-only; `system` actors skip the check.
 */
export function transferOwnership(
  input: TransferOwnershipInput
): Promise<
  MembershipResult<MembershipChange & { previousOwnerId: string | null }>
> {
  return guarded(input, "transferOwnership", () =>
    input.scope === "event"
      ? eventTransferOwnership(input)
      : clanTransferOwnership(input)
  )
}
