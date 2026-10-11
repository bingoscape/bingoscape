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
import { eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"

// User Management Actions
export async function updateUser(
  userId: string,
  data: {
    name?: string | null
    email?: string | null
    runescapeName?: string | null
  }
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
  }
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

  await db
    .delete(clanMembers)
    .where(
      sql`${clanMembers.clanId} = ${clanId} AND ${clanMembers.userId} = ${userId}`
    )

  revalidatePath(`/super-admin/clans/${clanId}`)
}

export async function updateClanMemberRole(
  clanId: string,
  userId: string,
  role: "admin" | "management" | "member" | "guest" | undefined
) {
  await requireSuperAdmin()

  await db
    .update(clanMembers)
    .set({ role })
    .where(
      sql`${clanMembers.clanId} = ${clanId} AND ${clanMembers.userId} = ${userId}`
    )

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
  }
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
    )`
  )

  await db.delete(tiles).where(
    sql`${tiles.bingoId} IN (
      SELECT ${bingos.id} FROM ${bingos}
      WHERE ${bingos.eventId} = ${eventId}
    )`
  )

  await db.delete(bingos).where(eq(bingos.eventId, eventId))
  await db.delete(teamMembers).where(
    sql`${teamMembers.teamId} IN (
      SELECT ${teams.id} FROM ${teams}
      WHERE ${teams.eventId} = ${eventId}
    )`
  )
  await db.delete(teams).where(eq(teams.eventId, eventId))
  await db
    .delete(eventParticipants)
    .where(eq(eventParticipants.eventId, eventId))

  // Finally delete the event
  await db.delete(events).where(eq(events.id, eventId))

  revalidatePath("/super-admin/events")
}

export async function removeEventParticipant(eventId: string, userId: string) {
  await requireSuperAdmin()

  await db
    .delete(eventParticipants)
    .where(
      sql`${eventParticipants.eventId} = ${eventId} AND ${eventParticipants.userId} = ${userId}`
    )

  revalidatePath(`/super-admin/events/${eventId}`)
}

export async function updateEventParticipantRole(
  eventId: string,
  userId: string,
  role: "admin" | "management" | "participant" | undefined
) {
  await requireSuperAdmin()

  await db
    .update(eventParticipants)
    .set({ role })
    .where(
      sql`${eventParticipants.eventId} = ${eventId} AND ${eventParticipants.userId} = ${userId}`
    )

  revalidatePath(`/super-admin/events/${eventId}`)
}
