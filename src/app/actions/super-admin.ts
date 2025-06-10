"use server"

import { requireSuperAdmin } from "@/lib/super-admin"
import { db } from "@/server/db"
import {
  users,
  clans,
  events,
  eventParticipants,
  clanMembers,
  bingos,
  teams,
  teamMembers,
  tiles,
  teamTileSubmissions,
} from "@/server/db/schema"
import { and, eq, desc, count, sql, SQL } from "drizzle-orm"
import { revalidatePath } from "next/cache"

export async function getSuperAdminStats() {
  await requireSuperAdmin()

  const [userCount] = await db.select({ count: count() }).from(users)
  const [clanCount] = await db.select({ count: count() }).from(clans)
  const [eventCount] = await db.select({ count: count() }).from(events)

  return {
    totalUsers: userCount?.count ?? 0,
    totalClans: clanCount?.count ?? 0,
    totalEvents: eventCount?.count ?? 0,
  }
}

export async function getAllUsers(page = 1, limit = 50, search = "") {
  await requireSuperAdmin()

  const offset = (page - 1) * limit

  const baseQuery = async (filters: SQL[]) => {
    return await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      runescapeName: users.runescapeName,
      image: users.image,
      emailVerified: users.emailVerified,
    }).from(users)
      .where(and(...filters))
      .orderBy(desc(users.emailVerified)).limit(limit).offset(offset)
  }

  const filters: SQL[] = []

  if (search) {
    filters.push(
      sql`${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`} OR ${users.runescapeName} ILIKE ${`%${search}%`}`,
    )
  }

  const usersData = await baseQuery(filters)

  const countFilters: SQL[] = []
  // Get total count for pagination
  const countQuery = async (filters: SQL[]) => {
    return db.select({ count: count() }).from(users).where(and(...filters))
  }

  if (search) {
    countFilters.push(sql`${users.name} ILIKE ${`%${search}%`} OR ${users.email} ILIKE ${`%${search}%`} OR ${users.runescapeName} ILIKE ${`%${search}%`}`)
  }

  const [totalCount] = await countQuery(countFilters)

  return {
    users: usersData,
    totalCount: totalCount?.count ?? 0,
    totalPages: Math.ceil((totalCount?.count ?? 0) / limit),
    currentPage: page,
  }
}

export async function getAllClans(page = 1, limit = 50, search = "") {
  await requireSuperAdmin()

  const offset = (page - 1) * limit

  const baseQuery = async (filters: SQL[]) => {
    return await db
      .select({
        id: clans.id,
        name: clans.name,
        description: clans.description,
        ownerId: clans.ownerId,
        createdAt: clans.createdAt,
        owner: {
          id: users.id,
          name: users.name,
          email: users.email,
          runescapeName: users.runescapeName,
        },
        memberCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${clanMembers}
        WHERE ${clanMembers.clanId} = ${clans.id}
      )`.as("memberCount"),
        eventCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${events}
        WHERE ${events.clanId} = ${clans.id}
      )`.as("eventCount"),
      })
      .from(clans)
      .leftJoin(users, eq(clans.ownerId, users.id))
      .orderBy(desc(clans.createdAt)).limit(limit).offset(offset)
      .where(and(...filters))
  }

  const filters: SQL[] = []

  if (search) {

    filters.push(sql`${clans.name} ILIKE ${`%${search}%`} OR ${clans.description} ILIKE ${`%${search}%`}`)
  }

  const clansData = await baseQuery(filters)

  // Get total count for pagination
  const countQuery = async (filters: SQL[]) => await db.select({ count: count() }).from(clans).where(and(...filters))

  const countFilters: SQL[] = []
  if (search) {
    countFilters.push(sql`${clans.name} ILIKE ${`%${search}%`} OR ${clans.description} ILIKE ${`%${search}%`}`)
  }

  const [totalCount] = await countQuery(countFilters)

  return {
    clans: clansData,
    totalCount: totalCount?.count ?? 0,
    totalPages: Math.ceil((totalCount?.count ?? 0) / limit),
    currentPage: page,
  }
}

export async function getAllEvents(page = 1, limit = 50, search = "") {
  await requireSuperAdmin()

  const offset = (page - 1) * limit

  const baseQuery = async (filters: SQL[]) => await db
    .select({
      id: events.id,
      title: events.title,
      description: events.description,
      startDate: events.startDate,
      endDate: events.endDate,
      createdAt: events.createdAt,
      locked: events.locked,
      public: events.public,
      creator: {
        id: users.id,
        name: users.name,
        email: users.email,
        runescapeName: users.runescapeName,
      },
      clan: {
        id: clans.id,
        name: clans.name,
      },
      participantCount: sql<number>`(
        SELECT COUNT(*)
        FROM ${eventParticipants}
        WHERE ${eventParticipants.eventId} = ${events.id}
      )`.as("participantCount"),
    })
    .from(events)
    .leftJoin(users, eq(events.creatorId, users.id))
    .leftJoin(clans, eq(events.clanId, clans.id))
    .orderBy(desc(events.createdAt)).limit(limit).offset(offset)
    .where(and(...filters))

  const filters: SQL[] = []
  if (search) {
    filters.push(sql`${events.title} ILIKE ${`%${search}%`} OR ${events.description} ILIKE ${`%${search}%`}`)
  }

  const eventsData = await baseQuery(filters)

  // Get total count for pagination
  const countQuery = async (filters: SQL[]) => db.select({ count: count() }).from(events).where(and(...filters))

  const countFilters: SQL[] = []
  if (search) {
    countFilters.push(sql`${events.title} ILIKE ${`%${search}%`} OR ${events.description} ILIKE ${`%${search}%`}`)
  }

  const [totalCount] = await countQuery(countFilters)

  return {
    events: eventsData,
    totalCount: totalCount?.count ?? 0,
    totalPages: Math.ceil((totalCount?.count ?? 0) / limit),
    currentPage: page,
  }
}

export async function getUserDetails(userId: string) {
  await requireSuperAdmin()

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  })

  if (!user) {
    throw new Error("User not found")
  }

  // Get user's clans
  const userClans = await db
    .select({
      clan: clans,
      isMain: clanMembers.isMain,
      role: clanMembers.role,
      joinedAt: clanMembers.joinedAt,
    })
    .from(clanMembers)
    .innerJoin(clans, eq(clanMembers.clanId, clans.id))
    .where(eq(clanMembers.userId, userId))

  // Get user's events
  const userEvents = await db
    .select({
      event: events,
      role: eventParticipants.role,
      joinedAt: eventParticipants.createdAt,
    })
    .from(eventParticipants)
    .innerJoin(events, eq(eventParticipants.eventId, events.id))
    .where(eq(eventParticipants.userId, userId))
    .orderBy(desc(events.createdAt))

  // Get events created by user
  const createdEvents = await db.query.events.findMany({
    where: eq(events.creatorId, userId),
    orderBy: [desc(events.createdAt)],
  })

  return {
    user,
    clans: userClans,
    participatingEvents: userEvents,
    createdEvents,
  }
}

export async function getClanDetails(clanId: string) {
  await requireSuperAdmin()

  const clan = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
    with: {
      members: {
        with: {
          user: true,
        },
      },
      events: {
        with: {
          creator: true,
        },
        orderBy: [desc(events.createdAt)],
      },
    },
  })

  if (!clan) {
    throw new Error("Clan not found")
  }

  return clan
}

export async function getEventDetails(eventId: string) {
  await requireSuperAdmin()

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      creator: true,
      clan: true,
      eventParticipants: {
        with: {
          user: true,
        },
      },
      bingos: true,
      teams: {
        with: {
          teamMembers: {
            with: {
              user: true,
            },
          },
        },
      },
    },
  })

  if (!event) {
    throw new Error("Event not found")
  }

  return event
}

// User Management Actions
export async function updateUser(
  userId: string,
  data: {
    name?: string | null
    email?: string | null
    runescapeName?: string | null
  },
) {
  await requireSuperAdmin()

  await db.update(users).set(data).where(eq(users.id, userId))

  revalidatePath(`/super-admin/users/${userId}`)
  revalidatePath("/super-admin/users")
}

export async function deleteUser(userId: string) {
  await requireSuperAdmin()

  // Delete in order to respect foreign key constraints
  // await db.delete(teamTileSubmissions).where(eq(teamTileSubmissions.userId, userId))
  await db.delete(teamMembers).where(eq(teamMembers.userId, userId))
  await db.delete(eventParticipants).where(eq(eventParticipants.userId, userId))
  await db.delete(clanMembers).where(eq(clanMembers.userId, userId))

  // // Update events to remove creator reference (or you could delete them)
  await db.delete(events).where(eq(events.creatorId, userId))
  //
  // // Update clans to remove owner reference (or you could delete them)
  // await db.update(clans).set({ ownerId: null }).where(eq(clans.ownerId, userId))

  // Finally delete the user
  await db.delete(users).where(eq(users.id, userId))

  revalidatePath("/super-admin/users")
}

// Clan Management Actions
export async function updateClan(
  clanId: string,
  data: {
    name?: string
    description?: string | null
    ownerId?: string | null
  },
) {
  await requireSuperAdmin()

  await db.update(clans).set(data).where(eq(clans.id, clanId))

  revalidatePath(`/super-admin/clans/${clanId}`)
  revalidatePath("/super-admin/clans")
}

export async function deleteClan(clanId: string) {
  await requireSuperAdmin()

  // Delete clan members
  await db.delete(clanMembers).where(eq(clanMembers.clanId, clanId))

  // Update events to remove clan reference
  await db.update(events).set({ clanId: null }).where(eq(events.clanId, clanId))

  // Delete the clan
  await db.delete(clans).where(eq(clans.id, clanId))

  revalidatePath("/super-admin/clans")
}

export async function removeClanMember(clanId: string, userId: string) {
  await requireSuperAdmin()

  await db.delete(clanMembers).where(sql`${clanMembers.clanId} = ${clanId} AND ${clanMembers.userId} = ${userId}`)

  revalidatePath(`/super-admin/clans/${clanId}`)
}

export async function updateClanMemberRole(clanId: string, userId: string, role: "admin" | "management" | "member" | "guest" | undefined) {
  await requireSuperAdmin()

  await db
    .update(clanMembers)
    .set({ role })
    .where(sql`${clanMembers.clanId} = ${clanId} AND ${clanMembers.userId} = ${userId}`)

  revalidatePath(`/super-admin/clans/${clanId}`)
}

// Event Management Actions
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
  },
) {
  await requireSuperAdmin()

  await db.update(events).set(data).where(eq(events.id, eventId))

  revalidatePath(`/super-admin/events/${eventId}`)
  revalidatePath("/super-admin/events")
}

export async function deleteEvent(eventId: string) {
  await requireSuperAdmin()

  // Delete in order to respect foreign key constraints
  await db.delete(teamTileSubmissions).where(
    sql`${teamTileSubmissions.tileId} IN (
      SELECT ${tiles.id} FROM ${tiles}
      WHERE ${tiles.bingoId} IN (
        SELECT ${bingos.id} FROM ${bingos}
        WHERE ${bingos.eventId} = ${eventId}
      )
    )`,
  )

  await db.delete(tiles).where(
    sql`${tiles.bingoId} IN (
      SELECT ${bingos.id} FROM ${bingos}
      WHERE ${bingos.eventId} = ${eventId}
    )`,
  )

  await db.delete(bingos).where(eq(bingos.eventId, eventId))
  await db.delete(teamMembers).where(
    sql`${teamMembers.teamId} IN (
      SELECT ${teams.id} FROM ${teams}
      WHERE ${teams.eventId} = ${eventId}
    )`,
  )
  await db.delete(teams).where(eq(teams.eventId, eventId))
  await db.delete(eventParticipants).where(eq(eventParticipants.eventId, eventId))

  // Finally delete the event
  await db.delete(events).where(eq(events.id, eventId))

  revalidatePath("/super-admin/events")
}

export async function removeEventParticipant(eventId: string, userId: string) {
  await requireSuperAdmin()

  await db
    .delete(eventParticipants)
    .where(sql`${eventParticipants.eventId} = ${eventId} AND ${eventParticipants.userId} = ${userId}`)

  revalidatePath(`/super-admin/events/${eventId}`)
}

export async function updateEventParticipantRole(eventId: string, userId: string, role: "admin" | "management" | "participant" | undefined) {
  await requireSuperAdmin()

  await db
    .update(eventParticipants)
    .set({ role })
    .where(sql`${eventParticipants.eventId} = ${eventId} AND ${eventParticipants.userId} = ${userId}`)

  revalidatePath(`/super-admin/events/${eventId}`)
}

// Get all users for dropdowns
export async function getAllUsersForDropdown() {
  await requireSuperAdmin()

  return await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      runescapeName: users.runescapeName,
    })
    .from(users)
    .orderBy(users.name)
}

// Get all clans for dropdowns
export async function getAllClansForDropdown() {
  await requireSuperAdmin()

  return await db
    .select({
      id: clans.id,
      name: clans.name,
    })
    .from(clans)
    .orderBy(clans.name)
}
