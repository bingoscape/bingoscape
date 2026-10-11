"use server"

import { and, count, eq, ne, sql } from "drizzle-orm"

import {
  clanAuditSnapshot,
  eventAuditSnapshot,
  pickKeys,
  userAuditLabel,
  userAuditSnapshot,
} from "@/lib/super-admin-audit"
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
import { revalidateAdmin } from "@/server/super-admin/revalidate"
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
 * limit, audit row) lives in `adminAction`. Reads are server-only queries in
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

interface MembershipGuardResult {
  parentName: string
  currentRole: string
}

/**
 * Locks the membership's parent row for the rest of the transaction, so two
 * concurrent demotions cannot both see "another admin exists", then refuses
 * changes that would orphan the clan owner or the last admin.
 */
async function guardMembershipChange(
  tx: AdminTx,
  scope: "clan" | "event",
  parentId: string,
  userId: string,
  nextRole: string | null
): Promise<MembershipGuardResult> {
  if (scope === "clan") {
    const [clan] = await tx
      .select({ ownerId: clans.ownerId, name: clans.name })
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
    return { parentName: clan.name, currentRole: member.role }
  }

  const [event] = await tx
    .select({ title: events.title })
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
  return { parentName: event.title, currentRole: participant.role }
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

    if (data.email !== undefined) {
      // Serialise admin email edits so the uniqueness check below cannot race.
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext('super-admin:user-email'))`
      )
    }

    const [current] = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        runescapeName: users.runescapeName,
      })
      .from(users)
      .where(eq(users.id, userId))
      .for("update")
      .limit(1)
    if (!current) throw notFoundError("User")

    const set: Partial<typeof users.$inferInsert> = {}
    if (data.name !== undefined) set.name = data.name
    if (data.runescapeName !== undefined) set.runescapeName = data.runescapeName

    if (data.email !== undefined) {
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

    if (Object.keys(set).length > 0) {
      const updated = await tx
        .update(users)
        .set(set)
        .where(eq(users.id, userId))
        .returning({ id: users.id })
      if (updated.length === 0) throw notFoundError("User")
    }

    const keys = Object.keys(set)
    return {
      audit: {
        action: "user.update",
        targetType: "user",
        targetId: userId,
        targetLabel: userAuditLabel(current),
        before: pickKeys(userAuditSnapshot(current), keys),
        after: pickKeys(userAuditSnapshot({ ...current, ...set }), keys),
      },
    }
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
    revalidateAdmin({ userIds: [userId] })
  }
  return result
}

const deleteUserAction = adminAction(
  "user.delete",
  deleteUserSchema,
  async ({ tx, admin, input }) => {
    const [target] = await tx
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        runescapeName: users.runescapeName,
      })
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
    const deletedEvents = await tx
      .delete(events)
      .where(eq(events.creatorId, input.userId))
      .returning({ id: events.id })

    const deleted = await tx
      .delete(users)
      .where(eq(users.id, input.userId))
      .returning({ id: users.id })
    if (deleted.length === 0) throw notFoundError("User")

    return {
      audit: {
        action: "user.delete",
        targetType: "user",
        targetId: input.userId,
        targetLabel: userAuditLabel(target),
        before: userAuditSnapshot(target),
        after: { deletedCreatedEvents: deletedEvents.length },
      },
    }
  }
)

export async function deleteUser(userId: string): Promise<AdminResult> {
  const result = await deleteUserAction({ userId })
  if (result.success) {
    // Also drops the user's created events and clears them as clan owner.
    revalidateAdmin({ userIds: [userId], clanIds: [], eventIds: [] })
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

    const [current] = await tx
      .select({
        name: clans.name,
        description: clans.description,
        ownerId: clans.ownerId,
      })
      .from(clans)
      .where(eq(clans.id, clanId))
      .for("update")
      .limit(1)
    if (!current) throw notFoundError("Clan")

    const set: Partial<typeof clans.$inferInsert> = { updatedAt: new Date() }
    const changed: string[] = []
    if (data.name !== undefined) {
      set.name = data.name
      changed.push("name")
    }
    if (data.description !== undefined) {
      set.description = data.description
      changed.push("description")
    }
    if (data.ownerId !== undefined) {
      if (data.ownerId !== null) {
        await assertUserExists(tx, data.ownerId, "Owner")
      }
      set.ownerId = data.ownerId
      changed.push("ownerId")
    }

    const updated = await tx
      .update(clans)
      .set(set)
      .where(eq(clans.id, clanId))
      .returning({ id: clans.id })
    if (updated.length === 0) throw notFoundError("Clan")

    return {
      audit: {
        action: "clan.update",
        targetType: "clan",
        targetId: clanId,
        targetLabel: set.name ?? current.name,
        before: pickKeys(clanAuditSnapshot(current), changed),
        after: pickKeys(clanAuditSnapshot({ ...current, ...set }), changed),
      },
    }
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
    revalidateAdmin({ clanIds: [clanId] })
  }
  return result
}

const deleteClanAction = adminAction(
  "clan.delete",
  deleteClanSchema,
  async ({ tx, input }) => {
    // clan_members cascade; events.clan_id is ON DELETE SET NULL.
    const [current] = await tx
      .select({
        name: clans.name,
        description: clans.description,
        ownerId: clans.ownerId,
      })
      .from(clans)
      .where(eq(clans.id, input.clanId))
      .for("update")
      .limit(1)
    if (!current) throw notFoundError("Clan")

    const deleted = await tx
      .delete(clans)
      .where(eq(clans.id, input.clanId))
      .returning({ id: clans.id })
    if (deleted.length === 0) throw notFoundError("Clan")

    return {
      audit: {
        action: "clan.delete",
        targetType: "clan",
        targetId: input.clanId,
        targetLabel: current.name,
        before: clanAuditSnapshot(current),
      },
    }
  }
)

export async function deleteClan(clanId: string): Promise<AdminResult> {
  const result = await deleteClanAction({ clanId })
  if (result.success) {
    revalidateAdmin({ clanIds: [clanId], eventIds: [] })
  }
  return result
}

const removeClanMemberAction = adminAction(
  "clan.member.remove",
  clanMemberSchema,
  async ({ tx, input }) => {
    const guard = await guardMembershipChange(
      tx,
      "clan",
      input.clanId,
      input.userId,
      null
    )
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

    return {
      audit: {
        action: "clan.member.remove",
        targetType: "clan",
        targetId: input.clanId,
        targetLabel: guard.parentName,
        before: { userId: input.userId, role: guard.currentRole },
      },
    }
  }
)

export async function removeClanMember(
  clanId: string,
  userId: string
): Promise<AdminResult> {
  const result = await removeClanMemberAction({ clanId, userId })
  if (result.success) {
    revalidateAdmin({ clanIds: [clanId], userIds: [userId] })
  }
  return result
}

const updateClanMemberRoleAction = adminAction(
  "clan.member.role",
  updateClanMemberRoleSchema,
  async ({ tx, input }) => {
    const guard = await guardMembershipChange(
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

    return {
      audit: {
        action: "clan.member.role",
        targetType: "clan",
        targetId: input.clanId,
        targetLabel: guard.parentName,
        before: { userId: input.userId, role: guard.currentRole },
        after: { userId: input.userId, role: input.role },
      },
    }
  }
)

export async function updateClanMemberRole(
  clanId: string,
  userId: string,
  role: (typeof CLAN_ROLES)[number]
): Promise<AdminResult> {
  const result = await updateClanMemberRoleAction({ clanId, userId, role })
  if (result.success) {
    revalidateAdmin({ clanIds: [clanId], userIds: [userId] })
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
      .select({
        title: events.title,
        description: events.description,
        startDate: events.startDate,
        endDate: events.endDate,
        locked: events.locked,
        public: events.public,
        clanId: events.clanId,
      })
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
    const changed: string[] = []
    if (data.title !== undefined) {
      set.title = data.title
      changed.push("title")
    }
    if (data.description !== undefined) {
      set.description = data.description
      changed.push("description")
    }
    if (data.startDate !== undefined) {
      set.startDate = data.startDate
      changed.push("startDate")
    }
    if (data.endDate !== undefined) {
      set.endDate = data.endDate
      changed.push("endDate")
    }
    if (data.locked !== undefined) {
      set.locked = data.locked
      changed.push("locked")
    }
    if (data.public !== undefined) {
      set.public = data.public
      changed.push("public")
    }
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
      changed.push("clanId")
    }

    const updated = await tx
      .update(events)
      .set(set)
      .where(eq(events.id, eventId))
      .returning({ id: events.id })
    if (updated.length === 0) throw notFoundError("Event")

    return {
      audit: {
        action: "event.update",
        targetType: "event",
        targetId: eventId,
        targetLabel: set.title ?? current.title,
        before: pickKeys(eventAuditSnapshot(current), changed),
        after: pickKeys(eventAuditSnapshot({ ...current, ...set }), changed),
      },
    }
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
    revalidateAdmin({ eventIds: [eventId] })
  }
  return result
}

const deleteEventAction = adminAction(
  "event.delete",
  deleteEventSchema,
  async ({ tx, input }) => {
    // bingos, tiles, teams, team members, submissions, participants and
    // invites are all removed by ON DELETE CASCADE foreign keys.
    const [current] = await tx
      .select({
        title: events.title,
        description: events.description,
        startDate: events.startDate,
        endDate: events.endDate,
        locked: events.locked,
        public: events.public,
        clanId: events.clanId,
      })
      .from(events)
      .where(eq(events.id, input.eventId))
      .for("update")
      .limit(1)
    if (!current) throw notFoundError("Event")

    const deleted = await tx
      .delete(events)
      .where(eq(events.id, input.eventId))
      .returning({ id: events.id })
    if (deleted.length === 0) throw notFoundError("Event")

    return {
      audit: {
        action: "event.delete",
        targetType: "event",
        targetId: input.eventId,
        targetLabel: current.title,
        before: eventAuditSnapshot(current),
      },
    }
  }
)

export async function deleteEvent(eventId: string): Promise<AdminResult> {
  const result = await deleteEventAction({ eventId })
  if (result.success) {
    revalidateAdmin({ eventIds: [eventId] })
  }
  return result
}

const removeEventParticipantAction = adminAction(
  "event.participant.remove",
  eventParticipantSchema,
  async ({ tx, input }) => {
    const guard = await guardMembershipChange(
      tx,
      "event",
      input.eventId,
      input.userId,
      null
    )
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

    return {
      audit: {
        action: "event.participant.remove",
        targetType: "event",
        targetId: input.eventId,
        targetLabel: guard.parentName,
        before: { userId: input.userId, role: guard.currentRole },
      },
    }
  }
)

export async function removeEventParticipant(
  eventId: string,
  userId: string
): Promise<AdminResult> {
  const result = await removeEventParticipantAction({ eventId, userId })
  if (result.success) {
    revalidateAdmin({ eventIds: [eventId], userIds: [userId] })
  }
  return result
}

const updateEventParticipantRoleAction = adminAction(
  "event.participant.role",
  updateEventParticipantRoleSchema,
  async ({ tx, input }) => {
    const guard = await guardMembershipChange(
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

    return {
      audit: {
        action: "event.participant.role",
        targetType: "event",
        targetId: input.eventId,
        targetLabel: guard.parentName,
        before: { userId: input.userId, role: guard.currentRole },
        after: { userId: input.userId, role: input.role },
      },
    }
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
    revalidateAdmin({ eventIds: [eventId], userIds: [userId] })
  }
  return result
}
