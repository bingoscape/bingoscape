"use server"

import { and, count, eq, ne, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

import { getSuperAdminEmails, normalizeEmail } from "@/lib/super-admin-email"
import {
  emailChangeBlocker,
  membershipChangeBlocker,
  userDeleteBlocker,
} from "@/lib/super-admin-invariants"
import {
  clanMemberSchema,
  deleteClanSchema,
  deleteEventSchema,
  deleteUserSchema,
  eventParticipantSchema,
  hasChanges,
  updateClanMemberRoleSchema,
  updateClanSchema,
  updateEventParticipantRoleSchema,
  updateEventSchema,
  updateUserSchema,
  type CLAN_ROLES,
  type EVENT_ROLES,
} from "@/lib/validation/super-admin"
import {
  clanMembers,
  clans,
  eventParticipants,
  events,
  users,
} from "@/server/db/schema"
import {
  adminAction,
  conflictError,
  invalidError,
  notFoundError,
  type AdminResult,
  type AdminTx,
} from "@/server/super-admin/admin-action"

/**
 * Super-admin mutations. Only async functions are exported from this
 * "use server" module; everything else (guard, validation, transaction, rate
 * limit) lives in `adminAction`. Reads are server-only queries in
 * `src/server/super-admin/queries.ts` and are intentionally not exported here.
 *
 * Each field written by an update is listed explicitly below, so columns such
 * as `password`, `username`, `id`, `creatorId`, `image` or `emailVerified`
 * can never be written from this module.
 */

async function assertUserExists(tx: AdminTx, userId: string, what: string) {
  const [row] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!row) throw notFoundError(what)
}

/**
 * Locks the membership's parent row for the rest of the transaction, so two
 * concurrent demotions cannot both see "another admin exists".
 */
async function guardMembershipChange(
  tx: AdminTx,
  scope: "clan" | "event",
  parentId: string,
  userId: string,
  nextRole: string | null
) {
  if (scope === "clan") {
    const [clan] = await tx
      .select({ ownerId: clans.ownerId })
      .from(clans)
      .where(eq(clans.id, parentId))
      .for("update")
      .limit(1)
    if (!clan) throw notFoundError("Clan")

    const [member] = await tx
      .select({ role: clanMembers.role })
      .from(clanMembers)
      .where(
        and(eq(clanMembers.clanId, parentId), eq(clanMembers.userId, userId))
      )
      .limit(1)
    if (!member) throw notFoundError("Clan member")

    const [admins] = await tx
      .select({ total: count() })
      .from(clanMembers)
      .where(
        and(eq(clanMembers.clanId, parentId), eq(clanMembers.role, "admin"))
      )
    const reason = membershipChangeBlocker({
      scope,
      isOwner: clan.ownerId === userId,
      currentRole: member.role,
      adminCount: admins?.total ?? 0,
      nextRole,
    })
    if (reason) throw conflictError(reason)
    return
  }

  const [event] = await tx
    .select({ id: events.id })
    .from(events)
    .where(eq(events.id, parentId))
    .for("update")
    .limit(1)
  if (!event) throw notFoundError("Event")

  const [participant] = await tx
    .select({ role: eventParticipants.role })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, parentId),
        eq(eventParticipants.userId, userId)
      )
    )
    .limit(1)
  if (!participant) throw notFoundError("Participant")

  const [admins] = await tx
    .select({ total: count() })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, parentId),
        eq(eventParticipants.role, "admin")
      )
    )
  const reason = membershipChangeBlocker({
    scope,
    isOwner: false,
    currentRole: participant.role,
    adminCount: admins?.total ?? 0,
    nextRole,
  })
  if (reason) throw conflictError(reason)
}

/* -------------------------------------------------------------------------- */
/* Users                                                                       */
/* -------------------------------------------------------------------------- */

const updateUserAction = adminAction(
  "user.update",
  updateUserSchema,
  async ({ tx, input }) => {
    const { userId, data } = input
    if (!hasChanges(data)) throw invalidError("Nothing to change.")

    const set: Partial<typeof users.$inferInsert> = {}
    if (data.name !== undefined) set.name = data.name
    if (data.runescapeName !== undefined) set.runescapeName = data.runescapeName

    if (data.email !== undefined) {
      // Serialise admin email edits so the uniqueness check below cannot race.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('super-admin:user-email'))`
      )
      const [current] = await tx
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, userId))
        .for("update")
        .limit(1)
      if (!current) throw notFoundError("User")

      const newEmail = normalizeEmail(data.email)
      // An unchanged address (ignoring case/whitespace) is left untouched.
      if (normalizeEmail(current.email) !== newEmail) {
        const reason = emailChangeBlocker({
          oldEmail: current.email,
          newEmail,
          adminEmails: getSuperAdminEmails(),
        })
        if (reason) throw conflictError(reason)

        if (newEmail) {
          const [taken] = await tx
            .select({ id: users.id })
            .from(users)
            .where(
              and(
                sql`lower(${users.email}) = ${newEmail}`,
                ne(users.id, userId)
              )
            )
            .limit(1)
          if (taken) {
            throw conflictError("Another user already uses this email.")
          }
        }
        set.email = newEmail
      }
    }

    if (Object.keys(set).length === 0) return

    const updated = await tx
      .update(users)
      .set(set)
      .where(eq(users.id, userId))
      .returning({ id: users.id })
    if (updated.length === 0) throw notFoundError("User")
  }
)

export async function updateUser(
  userId: string,
  data: {
    name?: string | null
    email?: string | null
    runescapeName?: string | null
  }
): Promise<AdminResult> {
  const result = await updateUserAction({ userId, data })
  if (result.success) {
    revalidatePath(`/super-admin/users/${userId}`)
    revalidatePath("/super-admin/users")
  }
  return result
}

const deleteUserAction = adminAction(
  "user.delete",
  deleteUserSchema,
  async ({ tx, admin, input }) => {
    const [target] = await tx
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, input.userId))
      .for("update")
      .limit(1)
    if (!target) throw notFoundError("User")

    const reason = userDeleteBlocker({
      actorId: admin.adminId,
      targetId: target.id,
      targetEmail: target.email,
      adminEmails: getSuperAdminEmails(),
    })
    if (reason) throw conflictError(reason)

    // Product behavior kept as-is: events the user created are deleted too
    // (their boards, teams and submissions cascade). Everything else owned by
    // the user (team/event/clan memberships, submissions, sessions, accounts)
    // is removed by the schema's ON DELETE CASCADE foreign keys.
    await tx.delete(events).where(eq(events.creatorId, input.userId))

    const deleted = await tx
      .delete(users)
      .where(eq(users.id, input.userId))
      .returning({ id: users.id })
    if (deleted.length === 0) throw notFoundError("User")
  }
)

export async function deleteUser(userId: string): Promise<AdminResult> {
  const result = await deleteUserAction({ userId })
  if (result.success) {
    revalidatePath("/super-admin/users")
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* Clans                                                                       */
/* -------------------------------------------------------------------------- */

const updateClanAction = adminAction(
  "clan.update",
  updateClanSchema,
  async ({ tx, input }) => {
    const { clanId, data } = input
    if (!hasChanges(data)) throw invalidError("Nothing to change.")

    const set: Partial<typeof clans.$inferInsert> = { updatedAt: new Date() }
    if (data.name !== undefined) set.name = data.name
    if (data.description !== undefined) set.description = data.description
    if (data.ownerId !== undefined) {
      if (data.ownerId !== null) {
        await assertUserExists(tx, data.ownerId, "Owner")
      }
      set.ownerId = data.ownerId
    }

    const updated = await tx
      .update(clans)
      .set(set)
      .where(eq(clans.id, clanId))
      .returning({ id: clans.id })
    if (updated.length === 0) throw notFoundError("Clan")
  }
)

export async function updateClan(
  clanId: string,
  data: {
    name?: string
    description?: string | null
    ownerId?: string | null
  }
): Promise<AdminResult> {
  const result = await updateClanAction({ clanId, data })
  if (result.success) {
    revalidatePath(`/super-admin/clans/${clanId}`)
    revalidatePath("/super-admin/clans")
  }
  return result
}

const deleteClanAction = adminAction(
  "clan.delete",
  deleteClanSchema,
  async ({ tx, input }) => {
    // clan_members cascade; events.clan_id is ON DELETE SET NULL.
    const deleted = await tx
      .delete(clans)
      .where(eq(clans.id, input.clanId))
      .returning({ id: clans.id })
    if (deleted.length === 0) throw notFoundError("Clan")
  }
)

export async function deleteClan(clanId: string): Promise<AdminResult> {
  const result = await deleteClanAction({ clanId })
  if (result.success) {
    revalidatePath("/super-admin/clans")
  }
  return result
}

const removeClanMemberAction = adminAction(
  "clan.member.remove",
  clanMemberSchema,
  async ({ tx, input }) => {
    await guardMembershipChange(tx, "clan", input.clanId, input.userId, null)
    const deleted = await tx
      .delete(clanMembers)
      .where(
        and(
          eq(clanMembers.clanId, input.clanId),
          eq(clanMembers.userId, input.userId)
        )
      )
      .returning({ id: clanMembers.id })
    if (deleted.length === 0) throw notFoundError("Clan member")
  }
)

export async function removeClanMember(
  clanId: string,
  userId: string
): Promise<AdminResult> {
  const result = await removeClanMemberAction({ clanId, userId })
  if (result.success) {
    revalidatePath(`/super-admin/clans/${clanId}`)
  }
  return result
}

const updateClanMemberRoleAction = adminAction(
  "clan.member.role",
  updateClanMemberRoleSchema,
  async ({ tx, input }) => {
    await guardMembershipChange(
      tx,
      "clan",
      input.clanId,
      input.userId,
      input.role
    )
    const updated = await tx
      .update(clanMembers)
      .set({ role: input.role })
      .where(
        and(
          eq(clanMembers.clanId, input.clanId),
          eq(clanMembers.userId, input.userId)
        )
      )
      .returning({ id: clanMembers.id })
    if (updated.length === 0) throw notFoundError("Clan member")
  }
)

export async function updateClanMemberRole(
  clanId: string,
  userId: string,
  role: (typeof CLAN_ROLES)[number]
): Promise<AdminResult> {
  const result = await updateClanMemberRoleAction({ clanId, userId, role })
  if (result.success) {
    revalidatePath(`/super-admin/clans/${clanId}`)
  }
  return result
}

/* -------------------------------------------------------------------------- */
/* Events                                                                      */
/* -------------------------------------------------------------------------- */

const updateEventAction = adminAction(
  "event.update",
  updateEventSchema,
  async ({ tx, input }) => {
    const { eventId, data } = input
    if (!hasChanges(data)) throw invalidError("Nothing to change.")

    const [current] = await tx
      .select({ startDate: events.startDate, endDate: events.endDate })
      .from(events)
      .where(eq(events.id, eventId))
      .for("update")
      .limit(1)
    if (!current) throw notFoundError("Event")

    const startDate = data.startDate ?? current.startDate
    const endDate = data.endDate ?? current.endDate
    if (endDate <= startDate) {
      throw invalidError("The end date must be after the start date.")
    }

    const set: Partial<typeof events.$inferInsert> = { updatedAt: new Date() }
    if (data.title !== undefined) set.title = data.title
    if (data.description !== undefined) set.description = data.description
    if (data.startDate !== undefined) set.startDate = data.startDate
    if (data.endDate !== undefined) set.endDate = data.endDate
    if (data.locked !== undefined) set.locked = data.locked
    if (data.public !== undefined) set.public = data.public
    if (data.clanId !== undefined) {
      if (data.clanId !== null) {
        const [clan] = await tx
          .select({ id: clans.id })
          .from(clans)
          .where(eq(clans.id, data.clanId))
          .limit(1)
        if (!clan) throw notFoundError("Clan")
      }
      set.clanId = data.clanId
    }

    const updated = await tx
      .update(events)
      .set(set)
      .where(eq(events.id, eventId))
      .returning({ id: events.id })
    if (updated.length === 0) throw notFoundError("Event")
  }
)

export async function updateEvent(
  eventId: string,
  data: {
    title?: string
    description?: string | null
    startDate?: Date
    endDate?: Date
    locked?: boolean
    public?: boolean
    clanId?: string | null
  }
): Promise<AdminResult> {
  const result = await updateEventAction({ eventId, data })
  if (result.success) {
    revalidatePath(`/super-admin/events/${eventId}`)
    revalidatePath("/super-admin/events")
  }
  return result
}

const deleteEventAction = adminAction(
  "event.delete",
  deleteEventSchema,
  async ({ tx, input }) => {
    // bingos, tiles, teams, team members, submissions, participants and
    // invites are all removed by ON DELETE CASCADE foreign keys.
    const deleted = await tx
      .delete(events)
      .where(eq(events.id, input.eventId))
      .returning({ id: events.id })
    if (deleted.length === 0) throw notFoundError("Event")
  }
)

export async function deleteEvent(eventId: string): Promise<AdminResult> {
  const result = await deleteEventAction({ eventId })
  if (result.success) {
    revalidatePath("/super-admin/events")
  }
  return result
}

const removeEventParticipantAction = adminAction(
  "event.participant.remove",
  eventParticipantSchema,
  async ({ tx, input }) => {
    await guardMembershipChange(tx, "event", input.eventId, input.userId, null)
    const deleted = await tx
      .delete(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, input.eventId),
          eq(eventParticipants.userId, input.userId)
        )
      )
      .returning({ id: eventParticipants.id })
    if (deleted.length === 0) throw notFoundError("Participant")
  }
)

export async function removeEventParticipant(
  eventId: string,
  userId: string
): Promise<AdminResult> {
  const result = await removeEventParticipantAction({ eventId, userId })
  if (result.success) {
    revalidatePath(`/super-admin/events/${eventId}`)
  }
  return result
}

const updateEventParticipantRoleAction = adminAction(
  "event.participant.role",
  updateEventParticipantRoleSchema,
  async ({ tx, input }) => {
    await guardMembershipChange(
      tx,
      "event",
      input.eventId,
      input.userId,
      input.role
    )
    const updated = await tx
      .update(eventParticipants)
      .set({ role: input.role, updatedAt: new Date() })
      .where(
        and(
          eq(eventParticipants.eventId, input.eventId),
          eq(eventParticipants.userId, input.userId)
        )
      )
      .returning({ id: eventParticipants.id })
    if (updated.length === 0) throw notFoundError("Participant")
  }
)

export async function updateEventParticipantRole(
  eventId: string,
  userId: string,
  role: (typeof EVENT_ROLES)[number]
): Promise<AdminResult> {
  const result = await updateEventParticipantRoleAction({
    eventId,
    userId,
    role,
  })
  if (result.success) {
    revalidatePath(`/super-admin/events/${eventId}`)
  }
  return result
}
