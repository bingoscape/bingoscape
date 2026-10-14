"use server"

import { eq, and, count, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

import { getServerAuthSession } from "@/server/auth"
import { addMember, changeRole, removeMember } from "@/server/authz/membership"
import { db } from "@/server/db"
import {
  clans,
  clanMembers,
  users,
  events,
  clanInvites,
  eventParticipants,
} from "@/server/db/schema"
import { logger } from "@/lib/logger"
import {
  MAX_ACTIVE_INVITES,
  MAX_INVITE_LABEL_LENGTH,
  canManageInvites,
  isClanRole,
  parseClanInviteCode,
  resolveInviteState,
  type ClanRole,
} from "@/lib/clan"
import { authorize, denial, type ActionResult } from "@/server/authz"

/**
 * Clan server actions. This file is the single source of truth for clan
 * mutations; read models for the clan pages live in `@/server/queries/clans`
 * (not server actions, so they are not callable from the browser).
 *
 * Mutations return `{ success, error? }` instead of throwing; `getUserClans`
 * returns an empty list for a signed-out caller. Clan roles are a separate
 * ladder from Event roles (`@/lib/clan`); the Event permission checks live in
 * `@/server/authz`.
 */

export type ClanActionResult<T extends object = object> =
  | ({ success: true } & T)
  | { success: false; error: string }

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0]

const NOT_SIGNED_IN = "You must be signed in"

function fail(error: string): { success: false; error: string } {
  return { success: false, error }
}

async function requireUserId(): Promise<string | null> {
  const session = await getServerAuthSession()
  return session?.user?.id ?? null
}

export async function createClan(
  name: string,
  description: string
): Promise<ClanActionResult<{ clan: typeof clans.$inferSelect }>> {
  const userId = await requireUserId()
  if (!userId) return fail("You must be signed in to create a clan")

  const cleanName = name?.trim() ?? ""
  const cleanDescription = description?.trim() ?? ""
  if (!cleanName) return fail("Give your clan a name")
  if (cleanName.length > 255) return fail("Clan name is too long (255 max)")
  if (cleanDescription.length > 1000) {
    return fail("Description is too long (1000 max)")
  }

  try {
    const clan = await db.transaction(async (tx) => {
      // The first clan a player joins or creates becomes their main clan.
      const existingMainClan = await tx
        .select()
        .from(clanMembers)
        .where(
          and(eq(clanMembers.userId, userId), eq(clanMembers.isMain, true))
        )
        .limit(1)

      const [created] = await tx
        .insert(clans)
        .values({
          name: cleanName,
          description: cleanDescription || null,
          ownerId: userId,
        })
        .returning()

      // The creator is the owner and the first admin.
      const added = await addMember({
        scope: "clan",
        parentId: created!.id,
        userId,
        role: "admin",
        isMain: existingMainClan.length === 0,
        actor: { kind: "system", userId },
        reason: "clan created",
        tx,
      })
      if (!added.success) throw new Error(added.error)

      return created!
    })

    revalidatePath("/clans")
    revalidatePath("/")
    return { success: true, clan }
  } catch (error) {
    logger.error({ error }, "Failed to create clan")
    return fail("Failed to create clan")
  }
}

const INVITE_ERRORS = {
  invalid: "This invite link isn't valid. Check the link or ask for a new one.",
  revoked: "This invite link was revoked. Ask a clan manager for a new one.",
  expired: "This invite link has expired. Ask a clan manager for a new one.",
  "limit-reached":
    "This invite link has been used the maximum number of times.",
  "already-member": "You're already a member of this clan.",
} as const

/**
 * Joins a clan through an invite code or pasted invite link. Invites are the
 * only way into a clan. Everything happens in one transaction and the use is
 * claimed with a conditional UPDATE, so a limited invite can't be overspent.
 */
export async function joinClanWithInvite(rawCode: string): Promise<
  | { success: true; clanId: string; clanName: string; isMain: boolean }
  | {
      success: false
      error: string
      reason: keyof typeof INVITE_ERRORS | "error"
      clanId?: string
    }
> {
  const userId = await requireUserId()
  if (!userId) {
    return { success: false, error: NOT_SIGNED_IN, reason: "error" }
  }

  const code = parseClanInviteCode(rawCode ?? "")
  if (!code) {
    return {
      success: false,
      error: "Paste an invite link or code.",
      reason: "invalid",
    }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const invite = await tx.query.clanInvites.findFirst({
        where: eq(clanInvites.inviteCode, code),
        with: { clan: true },
      })
      if (!invite) {
        return {
          success: false as const,
          error: INVITE_ERRORS.invalid,
          reason: "invalid" as const,
        }
      }

      const memberships = await tx.query.clanMembers.findMany({
        where: eq(clanMembers.userId, userId),
        columns: { clanId: true },
      })
      const state = resolveInviteState(
        invite,
        memberships.some((m) => m.clanId === invite.clanId)
      )
      if (state !== "ready") {
        return {
          success: false as const,
          error: INVITE_ERRORS[state],
          reason: state,
          clanId: invite.clanId,
        }
      }

      const claimed = await tx
        .update(clanInvites)
        .set({
          currentUses: sql`${clanInvites.currentUses} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(clanInvites.id, invite.id),
            eq(clanInvites.isActive, true),
            sql`(${clanInvites.maxUses} IS NULL OR ${clanInvites.currentUses} < ${clanInvites.maxUses})`
          )
        )
        .returning({ id: clanInvites.id })
      if (claimed.length === 0) {
        return {
          success: false as const,
          error: INVITE_ERRORS["limit-reached"],
          reason: "limit-reached" as const,
          clanId: invite.clanId,
        }
      }

      const isMain = memberships.length === 0
      const joined = await addMember({
        scope: "clan",
        parentId: invite.clanId,
        userId,
        role: "member",
        isMain,
        actor: { kind: "self", userId },
        reason: "joined through a clan invite",
        tx,
      })
      if (!joined.success) {
        if (joined.code === "ALREADY_MEMBER") {
          return {
            success: false as const,
            error: INVITE_ERRORS["already-member"],
            reason: "already-member" as const,
            clanId: invite.clanId,
          }
        }
        throw new Error(joined.error)
      }

      return {
        success: true as const,
        clanId: invite.clanId,
        clanName: invite.clan.name,
        isMain,
      }
    })

    if (result.success) {
      revalidatePath("/clans")
      revalidatePath(`/clans/${result.clanId}`)
      revalidatePath("/")
    }
    return result
  } catch (error) {
    logger.error({ error }, "Failed to join clan with invite")
    return {
      success: false,
      error: "Failed to join clan. Please try again.",
      reason: "error",
    }
  }
}

export async function leaveClan(clanId: string): Promise<ClanActionResult> {
  const userId = await requireUserId()
  if (!userId) return fail(NOT_SIGNED_IN)
  if (!clanId) return fail("Clan not found")

  const result = await removeMember({
    scope: "clan",
    parentId: clanId,
    userId,
    actor: { kind: "self", userId },
    reason: "left the clan",
  })
  if (!result.success) {
    if (result.code === "NOT_A_MEMBER") {
      return fail("You're not a member of this clan")
    }
    return fail(result.error)
  }

  revalidatePath("/clans")
  revalidatePath(`/clans/${clanId}`)
  revalidatePath("/")
  return { success: true }
}

export async function updateMemberRole(
  clanId: string,
  memberId: string,
  newRole: ClanRole
): Promise<ClanActionResult> {
  const userId = await requireUserId()
  if (!userId) return fail(NOT_SIGNED_IN)
  if (!clanId || !memberId) return fail("Member not found")
  if (!isClanRole(newRole)) return fail("Unknown role")

  // The helper locks the Clan, so the owner and last-admin rules are checked
  // against the admins as they are right now.
  const result = await changeRole({
    scope: "clan",
    parentId: clanId,
    userId: memberId,
    newRole,
    actor: { kind: "user", userId },
  })
  if (!result.success) return fail(result.error)

  revalidatePath(`/clans/${clanId}`)
  return { success: true }
}

// Clan invite management

export interface CreateClanInviteParams {
  clanId: string
  label?: string
  expiresInDays?: number | null // null/0 = permanent
  maxUses?: number | null // null = unlimited
}

async function getManagerMembership(tx: Tx, clanId: string, userId: string) {
  const membership = await tx.query.clanMembers.findFirst({
    where: and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, userId)),
  })
  return membership && canManageInvites(membership.role) ? membership : null
}

export async function createClanInvite(
  params: CreateClanInviteParams
): Promise<ClanActionResult<{ invite: typeof clanInvites.$inferSelect }>> {
  const userId = await requireUserId()
  if (!userId) return fail(NOT_SIGNED_IN)

  const label = params.label?.trim() ?? ""
  if (label.length > MAX_INVITE_LABEL_LENGTH) {
    return fail(`Label is too long (${MAX_INVITE_LABEL_LENGTH} max)`)
  }
  const days = params.expiresInDays ?? null
  if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
    return fail("Expiry must be between 1 and 365 days")
  }
  const maxUses = params.maxUses ?? null
  if (
    maxUses !== null &&
    (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 10000)
  ) {
    return fail("Usage limit must be between 1 and 10,000")
  }

  try {
    const result = await db.transaction(async (tx) => {
      if (!(await getManagerMembership(tx, params.clanId, userId))) {
        return fail("Only clan admins and managers can create invites")
      }

      const [active] = await tx
        .select({ count: count() })
        .from(clanInvites)
        .where(
          and(
            eq(clanInvites.clanId, params.clanId),
            eq(clanInvites.isActive, true)
          )
        )
      if ((active?.count ?? 0) >= MAX_ACTIVE_INVITES) {
        return fail(
          `Maximum active invite limit reached (${MAX_ACTIVE_INVITES}). Revoke an old invite first.`
        )
      }

      const [invite] = await tx
        .insert(clanInvites)
        .values({
          clanId: params.clanId,
          inviteCode: nanoid(10),
          expiresAt: days ? new Date(Date.now() + days * 86_400_000) : null,
          createdBy: userId,
          label: label || null,
          maxUses,
          currentUses: 0,
          isActive: true,
        })
        .returning()

      return { success: true as const, invite: invite! }
    })

    if (result.success) revalidatePath(`/clans/${params.clanId}`)
    return result
  } catch (error) {
    logger.error({ error }, "Failed to create clan invite")
    return fail("Failed to create invite")
  }
}

type InviteMutation = (
  tx: Tx,
  invite: typeof clanInvites.$inferSelect
) => Promise<void>

/** Shared auth + lookup for revoke / delete / relabel. */
async function mutateInvite(
  inviteId: string,
  denied: string,
  failure: string,
  mutate: InviteMutation
): Promise<ClanActionResult> {
  const userId = await requireUserId()
  if (!userId) return fail(NOT_SIGNED_IN)
  if (!inviteId) return fail("Invite not found")

  try {
    const result = await db.transaction(async (tx) => {
      const invite = await tx.query.clanInvites.findFirst({
        where: eq(clanInvites.id, inviteId),
      })
      if (!invite) return fail("Invite not found")
      if (!(await getManagerMembership(tx, invite.clanId, userId))) {
        return fail(denied)
      }
      await mutate(tx, invite)
      return { success: true as const, clanId: invite.clanId }
    })

    if (result.success) revalidatePath(`/clans/${result.clanId}`)
    return result.success ? { success: true } : result
  } catch (error) {
    logger.error({ error }, failure)
    return fail(failure)
  }
}

export async function revokeClanInvite(
  inviteId: string
): Promise<ClanActionResult> {
  return mutateInvite(
    inviteId,
    "Only clan admins and managers can revoke invites",
    "Failed to revoke invite",
    async (tx, invite) => {
      await tx
        .update(clanInvites)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(clanInvites.id, invite.id))
    }
  )
}

export async function deleteClanInvite(
  inviteId: string
): Promise<ClanActionResult> {
  return mutateInvite(
    inviteId,
    "Only clan admins and managers can delete invites",
    "Failed to delete invite",
    async (tx, invite) => {
      await tx.delete(clanInvites).where(eq(clanInvites.id, invite.id))
    }
  )
}

export async function updateClanInviteLabel(
  inviteId: string,
  label: string
): Promise<ClanActionResult> {
  const clean = label?.trim() ?? ""
  if (clean.length > MAX_INVITE_LABEL_LENGTH) {
    return fail(`Label is too long (${MAX_INVITE_LABEL_LENGTH} max)`)
  }
  return mutateInvite(
    inviteId,
    "Only clan admins and managers can edit invites",
    "Failed to update invite",
    async (tx, invite) => {
      await tx
        .update(clanInvites)
        .set({ label: clean || null, updatedAt: new Date() })
        .where(eq(clanInvites.id, invite.id))
    }
  )
}

export async function getUserClans() {
  // Deliberate: signed out reads as no Clans (see guards.ts).
  const session = await getServerAuthSession()
  if (!session || !session.user) return []

  const userClans = await db
    .select({
      clan: clans,
      isMain: clanMembers.isMain,
      owner: users,
      memberCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${clanMembers} AS cm
        WHERE cm.clan_id = ${clans.id}
      )`.as("memberCount"),
    })
    .from(clans)
    .innerJoin(clanMembers, eq(clans.id, clanMembers.clanId))
    .innerJoin(users, eq(users.id, clans.ownerId))
    .where(eq(clanMembers.userId, session.user.id))
    .groupBy(clans.id, clanMembers.isMain, users.id)

  return userClans
}

/**
 * Get clan members that can be added to an event
 * Excludes members who are already event participants
 */
export async function getClanMembersForEvent(eventId: string): Promise<
  ActionResult<{
    members: {
      id: string
      name: string | null
      runescapeName: string | null
      image: string | null
      role: ClanRole
    }[]
  }>
> {
  // Adding participants is a manager action (`participant:add`).
  const allowed = await authorize(eventId, "participant:add", {
    newRole: "participant",
  })
  if (!allowed.success) return denial(allowed)

  // Get the event and its clan
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: {
      id: true,
      clanId: true,
    },
  })

  if (!event)
    return { success: false, error: "Event not found", code: "NOT_FOUND" }

  if (!event.clanId) {
    return {
      success: false,
      error: "Event is not associated with a clan",
      code: "INVALID",
    }
  }

  // Get clan members who are not already event participants
  const availableMembers = await db
    .select({
      id: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
      role: clanMembers.role,
    })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .where(
      and(
        eq(clanMembers.clanId, event.clanId),
        sql`${users.id} NOT IN (
          SELECT ${eventParticipants.userId}
          FROM ${eventParticipants}
          WHERE ${eventParticipants.eventId} = ${eventId}
        )`
      )
    )
    .orderBy(
      sql`CASE
        WHEN ${clanMembers.role} = 'admin' THEN 1
        WHEN ${clanMembers.role} = 'management' THEN 2
        WHEN ${clanMembers.role} = 'member' THEN 3
        WHEN ${clanMembers.role} = 'guest' THEN 4
        ELSE 5
      END`
    )

  return { success: true, members: availableMembers }
}
