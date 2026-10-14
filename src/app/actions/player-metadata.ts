"use server"

import {
  actionFailure,
  authorize,
  denial,
  failure,
  hasPermission,
  type ActionResult,
} from "@/server/authz"
import { logger } from "@/lib/logger"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { playerMetadata, eventParticipants } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { fetchPlayerDataFromWOM, type FetchWOMDataResult } from "./wiseoldman"

/**
 * Get player metadata for a specific user in a specific event
 */
export async function getPlayerMetadata(userId: string, eventId: string) {
  // Managers read anyone's metadata. A participant reads their own, without the
  // management-only notes. Everybody else gets nothing.
  // Deliberate: a denial reads as null (see guards.ts).
  const callerIsManager = await hasPermission(eventId, "player-metadata:read")
  let isOwnRecord = false
  if (!callerIsManager) {
    const session = await getServerAuthSession()
    if (!session?.user || session.user.id !== userId) return null
    if (!(await hasPermission(eventId, "event:view"))) return null
    isOwnRecord = true
  }

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

  if (isOwnRecord && metadata) return { ...metadata, notes: null }
  return metadata
}

/**
 * Get all player metadata for an event (used for team balancing)
 */
export async function getEventParticipantMetadata(eventId: string) {
  // Deliberate: a denial reads as an empty list (see guards.ts).
  if (!(await hasPermission(eventId, "player-metadata:read"))) return []

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
    skillLevel?:
      | "beginner"
      | "intermediate"
      | "advanced"
      | "expert"
      | "pvmgod"
      | null
    timezone?: string | null
    dailyHoursAvailable?: number | null
    notes?: string | null
    runescapeNameOverride?: string | null
    womPlayerData?: string | null
    lastFetchedFromWOM?: Date | null
  }
): Promise<ActionResult<{ metadata: typeof playerMetadata.$inferSelect }>> {
  const allowed = await authorize(eventId, "player-metadata:write")
  if (!allowed.success) return denial(allowed)

  try {
    const metadata = await db.transaction(async (tx) => {
      const existing = await tx.query.playerMetadata.findFirst({
        where: and(
          eq(playerMetadata.userId, userId),
          eq(playerMetadata.eventId, eventId)
        ),
      })
      if (existing) {
        const [updated] = await tx
          .update(playerMetadata)
          .set({ ...data, updatedAt: new Date() })
          .where(eq(playerMetadata.id, existing.id))
          .returning()
        return updated
      }
      const [created] = await tx
        .insert(playerMetadata)
        .values({ userId, eventId, ...data })
        .returning()
      return created
    })
    if (!metadata) return failure("Failed to save player metadata")

    revalidatePath(`/events/${eventId}`)
    return { success: true, metadata }
  } catch (error) {
    logger.error({ error, eventId }, "Error saving player metadata")
    return actionFailure(error, "Failed to save player metadata")
  }
}

/**
 * Update own player metadata (self-editing)
 * Players can only update their timezone and dailyHoursAvailable
 * WoM fields (ehp, ehb, combatLevel, totalLevel) remain admin-only
 */
export async function updateOwnPlayerMetadata(
  eventId: string,
  data: {
    skillLevel?:
      | "beginner"
      | "intermediate"
      | "advanced"
      | "expert"
      | "pvmgod"
      | null
    timezone?: string | null
    dailyHoursAvailable?: number | null
    runescapeNameOverride?: string | null
  }
): Promise<ActionResult<{ metadata: typeof playerMetadata.$inferSelect }>> {
  // Any participant (`player-metadata:write-own`); the row is the caller's own.
  const allowed = await authorize(eventId, "player-metadata:write-own")
  if (!allowed.success) return denial(allowed)
  const userId = allowed.actor.userId

  // Only allow updating timezone and dailyHoursAvailable
  // Explicitly block any other fields to prevent tampering
  const allowedData = {
    skillLevel: data.skillLevel,
    timezone: data.timezone,
    dailyHoursAvailable: data.dailyHoursAvailable,
    runescapeNameOverride: data.runescapeNameOverride,
  }

  try {
    const metadata = await db.transaction(async (tx) => {
      const existing = await tx.query.playerMetadata.findFirst({
        where: and(
          eq(playerMetadata.userId, userId),
          eq(playerMetadata.eventId, eventId)
        ),
      })
      if (existing) {
        const [updated] = await tx
          .update(playerMetadata)
          .set({ ...allowedData, updatedAt: new Date() })
          .where(eq(playerMetadata.id, existing.id))
          .returning()
        return updated
      }
      const [created] = await tx
        .insert(playerMetadata)
        .values({ userId, eventId, ...allowedData })
        .returning()
      return created
    })
    if (!metadata) return failure("Failed to save player metadata")

    revalidatePath(`/events/${eventId}`)
    return { success: true, metadata }
  } catch (error) {
    logger.error({ error, eventId }, "Error saving own player metadata")
    return actionFailure(error, "Failed to save player metadata")
  }
}

/**
 * Delete player metadata for a specific event
 * Only accessible by management users
 */
export async function deletePlayerMetadata(
  userId: string,
  eventId: string
): Promise<ActionResult> {
  const allowed = await authorize(eventId, "player-metadata:write")
  if (!allowed.success) return denial(allowed)

  try {
    await db
      .delete(playerMetadata)
      .where(
        and(
          eq(playerMetadata.userId, userId),
          eq(playerMetadata.eventId, eventId)
        )
      )

    revalidatePath(`/events/${eventId}`)
    return { success: true }
  } catch (error) {
    logger.error({ error, eventId }, "Error deleting player metadata")
    return actionFailure(error, "Failed to delete player metadata")
  }
}

/**
 * Calculate data coverage percentage for an event
 * Returns the percentage of participants that have metadata
 */
export async function calculateMetadataCoverage(eventId: string) {
  // Deliberate: a denial reads as zero (see guards.ts).
  if (!(await hasPermission(eventId, "player-metadata:read"))) return 0

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
): Promise<FetchWOMDataResult> {
  const allowed = await authorize(eventId, "player-metadata:write")
  if (!allowed.success) return denial(allowed)

  // Check if user has an override
  const metadata = await db.query.playerMetadata.findFirst({
    where: and(
      eq(playerMetadata.userId, userId),
      eq(playerMetadata.eventId, eventId)
    ),
  })

  const effectiveName = metadata?.runescapeNameOverride || runescapeName

  // Fetch from WiseOldMan
  return fetchPlayerDataFromWOM(effectiveName)
}
