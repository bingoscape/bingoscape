"use server"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { playerMetadata, eventParticipants, events } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { fetchPlayerDataFromWOM, type WOMPlayerData } from "./wiseoldman"

/**
 * Get player metadata for a specific user in a specific event
 */
export async function getPlayerMetadata(userId: string, eventId: string) {
  const metadata = await db.query.playerMetadata.findFirst({
    where: and(
      eq(playerMetadata.userId, userId),
      eq(playerMetadata.eventId, eventId)
    ),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          runescapeName: true,
        },
      },
    },
  })

  return metadata
}

/**
 * Get all player metadata for an event (used for team balancing)
 */
export async function getEventParticipantMetadata(eventId: string) {
  const metadata = await db.query.playerMetadata.findMany({
    where: eq(playerMetadata.eventId, eventId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          runescapeName: true,
          image: true,
        },
      },
    },
  })

  return metadata
}

/**
 * Update or create player metadata for a specific event
 * Only accessible by management users
 */
export async function updatePlayerMetadata(
  userId: string,
  eventId: string,
  data: {
    ehp?: number | null
    ehb?: number | null
    combatLevel?: number | null
    totalLevel?: number | null
    timezone?: string | null
    dailyHoursAvailable?: number | null
    notes?: string | null
    womPlayerData?: string | null
    lastFetchedFromWOM?: Date | null
  }
) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in")
  }

  // Check if user has management rights for this event
  const participant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (!participant || (participant.role !== "management" && participant.role !== "admin")) {
    throw new Error("Unauthorized: You must be a management user for this event")
  }

  // Check if metadata already exists
  const existing = await db.query.playerMetadata.findFirst({
    where: and(
      eq(playerMetadata.userId, userId),
      eq(playerMetadata.eventId, eventId)
    ),
  })

  let result
  if (existing) {
    // Update existing metadata
    [result] = await db
      .update(playerMetadata)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(playerMetadata.id, existing.id))
      .returning()
  } else {
    // Create new metadata
    [result] = await db
      .insert(playerMetadata)
      .values({
        userId,
        eventId,
        ...data,
      })
      .returning()
  }

  revalidatePath(`/events/${eventId}`)
  return result
}

/**
 * Update own player metadata (self-editing)
 * Players can only update their timezone and dailyHoursAvailable
 * WoM fields (ehp, ehb, combatLevel, totalLevel) remain admin-only
 */
export async function updateOwnPlayerMetadata(
  eventId: string,
  data: {
    timezone?: string | null
    dailyHoursAvailable?: number | null
  }
) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in")
  }

  // Check if user is a participant in this event (any role)
  const participant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (!participant) {
    throw new Error("Unauthorized: You must be a participant in this event")
  }

  // Only allow updating timezone and dailyHoursAvailable
  // Explicitly block any other fields to prevent tampering
  const allowedData = {
    timezone: data.timezone,
    dailyHoursAvailable: data.dailyHoursAvailable,
  }

  // Check if metadata already exists
  const existing = await db.query.playerMetadata.findFirst({
    where: and(
      eq(playerMetadata.userId, session.user.id),
      eq(playerMetadata.eventId, eventId)
    ),
  })

  let result
  if (existing) {
    // Update existing metadata
    [result] = await db
      .update(playerMetadata)
      .set({
        ...allowedData,
        updatedAt: new Date(),
      })
      .where(eq(playerMetadata.id, existing.id))
      .returning()
  } else {
    // Create new metadata
    [result] = await db
      .insert(playerMetadata)
      .values({
        userId: session.user.id,
        eventId,
        ...allowedData,
      })
      .returning()
  }

  revalidatePath(`/events/${eventId}`)
  return result
}

/**
 * Delete player metadata for a specific event
 * Only accessible by management users
 */
export async function deletePlayerMetadata(userId: string, eventId: string) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in")
  }

  // Check if user has management rights for this event
  const participant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (!participant || (participant.role !== "management" && participant.role !== "admin")) {
    throw new Error("Unauthorized: You must be a management user for this event")
  }

  await db
    .delete(playerMetadata)
    .where(
      and(
        eq(playerMetadata.userId, userId),
        eq(playerMetadata.eventId, eventId)
      )
    )

  revalidatePath(`/events/${eventId}`)
}

/**
 * Calculate data coverage percentage for an event
 * Returns the percentage of participants that have metadata
 */
export async function calculateMetadataCoverage(eventId: string) {
  // Get total participants
  const participants = await db.query.eventParticipants.findMany({
    where: eq(eventParticipants.eventId, eventId),
  })

  if (participants.length === 0) {
    return 0
  }

  // Get participants with metadata
  const metadataRecords = await db.query.playerMetadata.findMany({
    where: eq(playerMetadata.eventId, eventId),
  })

  const coverage = (metadataRecords.length / participants.length) * 100
  return Math.round(coverage)
}

/**
 * Fetch player data from WiseOldMan and return it for client-side use
 * Only accessible by management users
 */
export async function fetchWOMDataForPlayer(
  userId: string,
  eventId: string,
  runescapeName: string
) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in")
  }

  // Check if user has management rights for this event
  const participant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (!participant || (participant.role !== "management" && participant.role !== "admin")) {
    throw new Error("Unauthorized: You must be a management user for this event")
  }

  // Fetch from WiseOldMan
  const result = await fetchPlayerDataFromWOM(runescapeName)

  return result
}
