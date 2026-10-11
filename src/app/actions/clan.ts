"use server"

import { eq, and, count, sql } from "drizzle-orm"
import { nanoid } from "nanoid"
import { revalidatePath } from "next/cache"

import { getServerAuthSession } from "@/server/auth"
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
  validateRoleChange,
  type ClanRole,
} from "@/lib/clan"
import { getUserRole } from "./events"

/**
 * Clan server actions. This file is the single source of truth for clan
 * mutations; read models for the clan pages live in `@/server/queries/clans`
 * (not server actions, so they are not callable from the browser).
 *
 * Mutations return `{ success, error? }` instead of throwing, except
 * `getUserClans` / `getClanMembersForEvent`, whose existing callers rely on
 * the throwing behaviour.
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
        .where(and(eq(clanMembers.userId, userId), eq(clanMembers.isMain, true)))
        .limit(1)

      const [created] = await tx
        .insert(clans)
        .values({
          name: cleanName,
          description: cleanDescription || null,
          ownerId: userId,
        })
        .returning()

      await tx.insert(clanMembers).values({
        clanId: created!.id,
        userId,
        isMain: existingMainClan.length === 0,
        role: "admin",
      })

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
export async function joinClanWithInvite(
  rawCode: string
): Promise<
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
      await tx.insert(clanMembers).values({
        clanId: invite.clanId,
        userId,
        role: "member",
        isMain,
      })

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

  try {
    const result = await db.transaction(async (tx) => {
      const clan = await tx.query.clans.findFirst({
        where: eq(clans.id, clanId),
      })
      if (!clan) return fail("Clan not found")
      if (clan.ownerId === userId) {
        return fail("The clan owner can't leave the clan")
      }

      const removed = await tx
        .delete(clanMembers)
        .where(
          and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, userId))
        )
        .returning({ id: clanMembers.id })
      if (removed.length === 0) return fail("You're not a member of this clan")

      return { success: true as const }
    })

    if (result.success) {
      revalidatePath("/clans")
      revalidatePath(`/clans/${clanId}`)
      revalidatePath("/")
    }
    return result
  } catch (error) {
    logger.error({ error }, "Failed to leave clan")
    return fail("Failed to leave clan")
  }
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

  try {
    const result = await db.transaction(async (tx) => {
      const clan = await tx.query.clans.findFirst({
        where: eq(clans.id, clanId),
      })
      if (!clan) return fail("Clan not found")

      const actor = await tx.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, clanId),
          eq(clanMembers.userId, userId)
        ),
      })
      const target = await tx.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, clanId),
          eq(clanMembers.userId, memberId)
        ),
      })
      const [admins] = await tx
        .select({ count: count() })
        .from(clanMembers)
        .where(
          and(eq(clanMembers.clanId, clanId), eq(clanMembers.role, "admin"))
        )

      const verdict = validateRoleChange({
        actorId: userId,
        actorRole: actor?.role,
        targetId: memberId,
        targetRole: target?.role,
        newRole,
        ownerId: clan.ownerId,
        adminCount: admins?.count ?? 0,
      })
      if (!verdict.ok) return fail(verdict.error)

      await tx
        .update(clanMembers)
        .set({ role: newRole })
        .where(
          and(
            eq(clanMembers.clanId, clanId),
            eq(clanMembers.userId, memberId)
          )
        )
      return { success: true as const }
    })

    if (result.success) revalidatePath(`/clans/${clanId}`)
    return result
  } catch (error) {
    logger.error({ error }, "Failed to update clan member role")
    return fail("Failed to update the member's role")
  }
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
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("You must be logged in to view your clans")
  }

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
export async function getClanMembersForEvent(eventId: string) {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new Error("Not authenticated")
  }

  // Check user has admin/management role for the event
  const userRole = await getUserRole(eventId)
  if (!userRole || !["admin", "management"].includes(userRole)) {
    throw new Error("Not authorized to manage event participants")
  }

  // Get the event and its clan
  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    columns: {
      id: true,
      clanId: true,
    },
  })

  if (!event) {
    throw new Error("Event not found")
  }

  if (!event.clanId) {
    throw new Error("Event is not associated with a clan")
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

  return availableMembers
}
