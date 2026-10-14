import "server-only"

import { and, eq, inArray } from "drizzle-orm"

import { logger } from "@/lib/logger"
import {
  assertTeamLimitForBattleship,
  BattleshipRuleError,
} from "@/server/battleship"
import type { db } from "@/server/db"
import {
  eventParticipants,
  events,
  teamMembers,
  teams,
} from "@/server/db/schema"
import { recordEventAudit } from "./audit-log"

/**
 * The team draft's way to write `team_members` (team draft 1/4, #215).
 *
 * `membership.ts` owns `event_participants` and `clan_members`; its role ledger
 * has no Team scope, so Team changes are recorded in `event_audit_log`
 * instead, one row per call. Every function runs in the caller's transaction,
 * locks the Event row `FOR UPDATE` (the lock `removeMember` takes, so applying
 * a draft cannot race a participant being removed), re-checks that every user
 * is still an `event_participants` row and not yet on a Team of this Event,
 * and always sets `team_members.event_id`. A refusal writes nothing and comes
 * back as `{ success: false, error, code }`.
 *
 * Out of scope here: moving the other `team_members` writers (`events.ts`,
 * `team.ts`, `team-balancing.ts`) onto this module and extending the grep gate
 * of `membership-gate.test.ts` to `team_members`; tracked as a follow-up.
 *
 * Not a "use server" module: nothing here is callable from the browser.
 */

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

/** Why a Team write happens; recorded in the audit row. */
export type TeamMembershipSource = "draft_start" | "draft_apply"

export type TeamMembershipErrorCode =
  | "NOT_FOUND"
  | "NOT_PARTICIPANT"
  | "ALREADY_ON_TEAM"
  | "INVALID"
  | "TEAM_LIMIT"

export interface TeamMembershipFailure {
  success: false
  error: string
  code: TeamMembershipErrorCode
  /** The users the refusal is about (left the Event, already on a Team). */
  userIds?: string[]
}

export type TeamMembershipResult<T extends object = object> =
  | ({ success: true } & T)
  | TeamMembershipFailure

interface BaseInput {
  eventId: string
  /** Who triggers the write (the manager or captain acting). */
  actor: { userId: string | null }
  source: TeamMembershipSource
  /** The draft the write belongs to, for the audit row. */
  draftId?: string
}

export interface AddTeamMembersInput extends BaseInput {
  teamId: string
  userIds: readonly string[]
  /**
   * A user who is no longer an Event participant is skipped and reported
   * instead of refusing the whole call. A user who is already on a Team of the
   * Event always refuses it.
   */
  skipMissing?: boolean
}

export interface CreateDraftTeamsInput extends BaseInput {
  draftId: string
  /** One Team per captain, in order. */
  teams: readonly { name: string; captainUserId: string }[]
}

function fail(
  code: TeamMembershipErrorCode,
  error: string,
  userIds?: string[]
): TeamMembershipFailure {
  return userIds
    ? { success: false, error, code, userIds }
    : { success: false, error, code }
}

/** Locks the Event row `FOR UPDATE`; false when there is no such Event. */
export async function lockEventRow(tx: Tx, eventId: string): Promise<boolean> {
  const [event] = await tx
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, eventId))
    .for("update")
    .limit(1)
  return event !== undefined
}

/** The subset of `userIds` that are participants of the Event. */
export async function participantsAmong(
  tx: Tx,
  eventId: string,
  userIds: readonly string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const rows = await tx
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        inArray(eventParticipants.userId, [...userIds])
      )
    )
  return new Set(rows.map((r) => r.userId))
}

/**
 * The subset of `userIds` that already sit on a Team of the Event. Joined
 * through `teams` rather than read from `team_members.event_id`: rows written
 * by the previous app version can still have it NULL.
 */
export async function onATeamAmong(
  tx: Tx,
  eventId: string,
  userIds: readonly string[]
): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const rows = await tx
    .select({ userId: teamMembers.userId })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(
      and(eq(teams.eventId, eventId), inArray(teamMembers.userId, [...userIds]))
    )
  return new Set(rows.map((r) => r.userId))
}

/**
 * Adds players to an existing Team of the Event (the drafted players of one
 * slot). Writes one `event_audit_log` row for the call.
 */
export async function addTeamMembers(
  tx: Tx,
  input: AddTeamMembersInput
): Promise<
  TeamMembershipResult<{
    added: string[]
    skipped: { userId: string; reason: "not_participant" }[]
  }>
> {
  const userIds = [...new Set(input.userIds)]
  if (!(await lockEventRow(tx, input.eventId))) {
    return fail("NOT_FOUND", "Event not found")
  }
  const [team] = await tx
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.id, input.teamId), eq(teams.eventId, input.eventId)))
    .limit(1)
  if (!team) return fail("NOT_FOUND", "Team not found")
  if (userIds.length === 0) return { success: true, added: [], skipped: [] }

  const participants = await participantsAmong(tx, input.eventId, userIds)
  const missing = userIds.filter((id) => !participants.has(id))
  if (missing.length > 0 && !input.skipMissing) {
    return fail(
      "NOT_PARTICIPANT",
      "Some players are no longer participants of this event",
      missing
    )
  }
  const present = userIds.filter((id) => participants.has(id))

  const onATeam = await onATeamAmong(tx, input.eventId, present)
  if (onATeam.size > 0) {
    return fail(
      "ALREADY_ON_TEAM",
      "Some players are already on a team in this event",
      [...onATeam]
    )
  }

  if (present.length > 0) {
    await tx.insert(teamMembers).values(
      present.map((userId) => ({
        teamId: input.teamId,
        eventId: input.eventId,
        userId,
        isLeader: false,
      }))
    )
  }
  await recordEventAudit(tx, {
    eventId: input.eventId,
    actorUserId: input.actor.userId,
    action: "team.members.add",
    permission: input.source === "draft_apply" ? "draft:manage" : null,
    targetType: "team",
    targetId: input.teamId,
    outcome: "success",
    before: null,
    after: {
      draftId: input.draftId ?? null,
      userIds: present,
      source: input.source,
    },
    reason: input.source,
  })
  return {
    success: true,
    added: present,
    skipped: missing.map((userId) => ({
      userId,
      reason: "not_participant" as const,
    })),
  }
}

/**
 * Creates one Team per captain and makes each captain its leader, in the
 * caller's transaction (the start of a draft). Refuses when a captain is no
 * longer a participant or already sits on a Team, or when a battleship board
 * limits the Event to two Teams. Writes one `event_audit_log` row.
 */
export async function createDraftTeams(
  tx: Tx,
  input: CreateDraftTeamsInput
): Promise<
  TeamMembershipResult<{
    teams: { name: string; teamId: string; captainUserId: string }[]
  }>
> {
  const captainIds = input.teams.map((t) => t.captainUserId)
  if (new Set(captainIds).size !== captainIds.length) {
    return fail("INVALID", "A player can only captain one team")
  }
  if (input.teams.length === 0) {
    return fail("INVALID", "A draft needs at least one team")
  }
  if (!(await lockEventRow(tx, input.eventId))) {
    return fail("NOT_FOUND", "Event not found")
  }

  const participants = await participantsAmong(tx, input.eventId, captainIds)
  const missing = captainIds.filter((id) => !participants.has(id))
  if (missing.length > 0) {
    return fail(
      "NOT_PARTICIPANT",
      "A captain is no longer a participant of this event",
      missing
    )
  }
  const onATeam = await onATeamAmong(tx, input.eventId, captainIds)
  if (onATeam.size > 0) {
    return fail(
      "ALREADY_ON_TEAM",
      "A captain is already on a team in this event",
      [...onATeam]
    )
  }
  try {
    // Battleship events are played by exactly two teams.
    await assertTeamLimitForBattleship(tx, input.eventId, input.teams.length)
  } catch (error) {
    if (error instanceof BattleshipRuleError) {
      return fail("TEAM_LIMIT", error.message)
    }
    throw error
  }

  const created: { name: string; teamId: string; captainUserId: string }[] = []
  for (const team of input.teams) {
    const [row] = await tx
      .insert(teams)
      .values({ eventId: input.eventId, name: team.name })
      .returning({ id: teams.id })
    if (!row) {
      logger.error({ eventId: input.eventId }, "Team insert returned no row")
      throw new Error("Team insert returned no row")
    }
    await tx.insert(teamMembers).values({
      teamId: row.id,
      eventId: input.eventId,
      userId: team.captainUserId,
      isLeader: true,
    })
    created.push({
      name: team.name,
      teamId: row.id,
      captainUserId: team.captainUserId,
    })
  }

  await recordEventAudit(tx, {
    eventId: input.eventId,
    actorUserId: input.actor.userId,
    action: "team.draft_teams.create",
    permission: "draft:manage",
    targetType: "draft",
    targetId: input.draftId,
    outcome: "success",
    before: null,
    after: {
      draftId: input.draftId,
      source: input.source,
      teams: created.map((t) => ({
        teamId: t.teamId,
        captainUserId: t.captainUserId,
      })),
    },
    reason: input.source,
  })
  return { success: true, teams: created }
}
