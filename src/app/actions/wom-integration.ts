"use server"

import { db } from "@/server/db"
import { users, tiles, teamTileSubmissions, events } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { createNotification } from "./notifications"
import { revalidatePath } from "next/cache"
import type { WomPlayerDetails, WomEvent, WomVerificationConfig, WomPlayerEventProgress } from "@/types/wom-types"

// WOM API base URL
const WOM_API_BASE_URL = "https://api.wiseoldman.net/v2"

/**
 * Link a user's RuneScape account to Wise Old Man
 */
export async function linkWomAccount(userId: string, runescapeName: string) {
  try {
    // First, check if the player exists on WOM
    const playerExists = await checkPlayerExistsOnWom(runescapeName)

    if (!playerExists) {
      // If player doesn't exist, track them on WOM
      await trackPlayerOnWom(runescapeName)
    }

    // Update the user's RuneScape name in our database
    await db.update(users).set({ runescapeName }).where(eq(users.id, userId))

    return { success: true }
  } catch (error) {
    console.error("Error linking WOM account:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to link account",
    }
  }
}

/**
 * Check if a player exists on Wise Old Man
 */
async function checkPlayerExistsOnWom(username: string): Promise<boolean> {
  try {
    const response = await fetch(`${WOM_API_BASE_URL}/players/${encodeURIComponent(username)}`)
    return response.status === 200
  } catch (error) {
    console.error("Error checking player on WOM:", error)
    return false
  }
}

/**
 * Track a player on Wise Old Man
 */
async function trackPlayerOnWom(username: string): Promise<void> {
  try {
    const response = await fetch(`${WOM_API_BASE_URL}/players`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Failed to track player on WOM")
    }
  } catch (error) {
    console.error("Error tracking player on WOM:", error)
    throw error
  }
}

/**
 * Get player details from Wise Old Man
 */
export async function getWomPlayerDetails(username: string): Promise<WomPlayerDetails> {
  try {
    const response = await fetch(`${WOM_API_BASE_URL}/players/${encodeURIComponent(username)}`)

    if (!response.ok) {
      throw new Error(`Failed to fetch player details: ${response.statusText}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Error fetching WOM player details:", error)
    throw error
  }
}

/**
 * Refresh a player's stats on Wise Old Man
 */
export async function refreshWomPlayerStats(username: string): Promise<void> {
  try {
    const response = await fetch(`${WOM_API_BASE_URL}/players/${encodeURIComponent(username)}/update`, {
      method: "POST",
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Failed to update player stats")
    }
  } catch (error) {
    console.error("Error refreshing WOM player stats:", error)
    throw error
  }
}

/**
 * Get events from Wise Old Man
 */
export async function getWomEvents(): Promise<WomEvent[]> {
  try {
    // Fetch upcoming competitions
    const upcomingResponse = await fetch(`${WOM_API_BASE_URL}/competitions?status=upcoming&limit=5`)

    // Fetch ongoing competitions
    const ongoingResponse = await fetch(`${WOM_API_BASE_URL}/competitions?status=ongoing&limit=5`)

    // Fetch recently ended competitions
    const finishedResponse = await fetch(`${WOM_API_BASE_URL}/competitions?status=finished&limit=5`)

    if (!upcomingResponse.ok || !ongoingResponse.ok || !finishedResponse.ok) {
      throw new Error("Failed to fetch competitions")
    }

    const upcomingData = await upcomingResponse.json()
    const ongoingData = await ongoingResponse.json()
    const finishedData = await finishedResponse.json()

    // Combine all events
    return [
      ...upcomingData.map((event: any) => ({ ...event, status: "upcoming" })),
      ...ongoingData.map((event: any) => ({ ...event, status: "ongoing" })),
      ...finishedData.map((event: any) => ({ ...event, status: "finished" })),
    ]
  } catch (error) {
    console.error("Error fetching WOM events:", error)
    throw error
  }
}

/**
 * Join a Wise Old Man event
 */
export async function joinWomEvent(eventId: string, username: string): Promise<void> {
  try {
    const response = await fetch(`${WOM_API_BASE_URL}/competitions/${eventId}/participants`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
      }),
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || "Failed to join competition")
    }
  } catch (error) {
    console.error("Error joining WOM event:", error)
    throw error
  }
}

/**
 * Get player progress in a WOM event
 */
export async function getPlayerEventProgress(
  username: string,
  metric: string,
  womEventId?: number,
): Promise<WomPlayerEventProgress | null> {
  try {
    if (womEventId) {
      // If we have a specific WOM event ID, fetch progress from that competition
      const response = await fetch(
        `${WOM_API_BASE_URL}/competitions/${womEventId}/progress/${encodeURIComponent(username)}`,
      )

      if (!response.ok) {
        if (response.status === 404) {
          return null // Player not participating in this competition
        }
        throw new Error(`Failed to fetch player progress: ${response.statusText}`)
      }

      return await response.json()
    } else {
      // Otherwise, use the delta endpoint to get progress over a time period
      // First get the player details to get their ID
      const playerDetails = await getWomPlayerDetails(username)

      // Then fetch deltas for the specific metric
      const response = await fetch(
        `${WOM_API_BASE_URL}/players/${playerDetails.id}/gained?metric=${metric}&period=custom`,
      )

      if (!response.ok) {
        throw new Error(`Failed to fetch player deltas: ${response.statusText}`)
      }

      const deltaData = await response.json()

      return {
        playerId: playerDetails.id,
        username: playerDetails.username,
        displayName: playerDetails.displayName,
        progress: {
          start: deltaData.startsAt || 0,
          end: deltaData.endsAt || 0,
          gained: deltaData.gained || 0,
        },
      }
    }
  } catch (error) {
    console.error("Error fetching player event progress:", error)
    return null
  }
}

/**
 * Verify a tile using Wise Old Man data
 */
export async function verifyTileWithWom(tileId: string, teamId: string, eventId: string, username: string) {
  try {
    // Get the tile details to check verification config
    const tileResult = await db
      .select({
        id: tiles.id,
        bingoId: tiles.bingoId,
        title: tiles.title,
        womVerificationConfig: tiles.womVerificationConfig,
      })
      .from(tiles)
      .where(eq(tiles.id, tileId))
      .execute()

    if (tileResult.length === 0) {
      return { success: false, error: "Tile not found" }
    }

    const tile = tileResult[0]!
    const verificationConfig = tile.womVerificationConfig as WomVerificationConfig | undefined

    if (!verificationConfig?.enabled) {
      return { success: false, error: "Auto-verification is not enabled for this tile" }
    }

    // Get event details for timeframe if needed
    let eventTimeframe = null
    if (verificationConfig.verifyMode === "event_gains" && !verificationConfig.womEventId) {
      const eventResult = await db
        .select({
          startDate: events.startDate,
          endDate: events.endDate,
        })
        .from(events)
        .where(eq(events.id, eventId))
        .execute()

      if (eventResult.length === 0) {
        return { success: false, error: "Event not found" }
      }

      eventTimeframe = eventResult[0]
    }

    // Check if the player meets the verification criteria
    let isVerified = false

    if (verificationConfig.verifyMode === "total") {
      // Get player details from WOM for total stats
      const playerDetails = await getWomPlayerDetails(username)
      isVerified = checkTotalStatsCriteria(playerDetails, verificationConfig)
    } else {
      // Get player progress during the event
      const playerProgress = await getPlayerEventProgress(
        username,
        verificationConfig.metric,
        verificationConfig.womEventId,
      )

      if (!playerProgress) {
        return {
          success: false,
          error: verificationConfig.womEventId
            ? "You are not participating in the selected WOM event"
            : "Could not fetch your progress data",
        }
      }

      isVerified = checkEventGainsCriteria(playerProgress, verificationConfig)
    }

    if (!isVerified) {
      return {
        success: false,
        error: `Your ${verificationConfig.metric.replace("_", " ")} ${verificationConfig.measureType} ${verificationConfig.verifyMode === "event_gains" ? "gained during the event" : ""} does not meet the required threshold`,
      }
    }

    // Update the team tile submission status to accepted
    const session = await getServerAuthSession()
    if (!session?.user) {
      return { success: false, error: "User not authenticated" }
    }

    // Get or create teamTileSubmission
    const [teamTileSubmission] = await db
      .insert(teamTileSubmissions)
      .values({
        tileId,
        teamId,
        status: "accepted", // Auto-verified tiles are automatically accepted
        reviewedBy: session.user.id,
      })
      .onConflictDoUpdate({
        target: [teamTileSubmissions.tileId, teamTileSubmissions.teamId],
        set: {
          updatedAt: new Date(),
          status: "accepted",
          reviewedBy: session.user.id,
        },
      })
      .returning()

    // Create a notification for admin and management users
    await createNotification(
      eventId,
      tileId,
      teamId,
      `Tile "${tile.title}" was automatically verified for ${username} using Wise Old Man data`,
    )

    // Revalidate the bingo page
    revalidatePath("/bingo")
    revalidatePath(`/events/${eventId}/bingos/${tile.bingoId}`)

    return { success: true }
  } catch (error) {
    console.error("Error verifying tile with WOM:", error)
    return { success: false, error: "Failed to verify tile" }
  }
}

/**
 * Check if a player meets the verification criteria based on total stats
 */
function checkTotalStatsCriteria(playerDetails: WomPlayerDetails, config: WomVerificationConfig): boolean {
  if (!playerDetails.latestSnapshot?.data) {
    return false
  }

  const { type, metric, threshold, comparison, measureType } = config
  let actualValue: number | undefined

  // Get the actual value based on the metric type
  if (type === "skill" && playerDetails.latestSnapshot.data.skills) {
    const skillData = playerDetails.latestSnapshot.data.skills[metric]
    if (skillData) {
      actualValue = measureType === "level" ? skillData.level : skillData.experience
    }
  } else if (type === "boss" && playerDetails.latestSnapshot.data.bosses) {
    const bossData = playerDetails.latestSnapshot.data.bosses[metric]
    if (bossData) {
      actualValue = bossData.kills
    }
  } else if (type === "activity" && playerDetails.latestSnapshot.data.activities) {
    const activityData = playerDetails.latestSnapshot.data.activities[metric]
    if (activityData) {
      actualValue = activityData.score
    }
  }

  // If we couldn't find the value, verification fails
  if (actualValue === undefined) {
    return false
  }

  // Compare the actual value with the threshold
  return compareValues(actualValue, threshold, comparison)
}

/**
 * Check if a player meets the verification criteria based on event gains
 */
function checkEventGainsCriteria(playerProgress: WomPlayerEventProgress, config: WomVerificationConfig): boolean {
  const { threshold, comparison, measureType, type } = config

  // For skills, we might be checking level gains instead of experience
  let actualValue: number

  if (type === "skill" && measureType === "level" && playerProgress.levels) {
    actualValue = playerProgress.levels.gained
  } else {
    actualValue = playerProgress.progress.gained
  }

  // Compare the gained value with the threshold
  return compareValues(actualValue, threshold, comparison)
}

/**
 * Compare values based on the comparison operator
 */
function compareValues(actual: number, threshold: number, comparison: WomVerificationConfig["comparison"]): boolean {
  switch (comparison) {
    case "greater_than":
      return actual > threshold
    case "greater_than_equal":
      return actual >= threshold
    case "equal":
      return actual === threshold
    case "less_than":
      return actual < threshold
    case "less_than_equal":
      return actual <= threshold
    default:
      return false
  }
}

/**
 * Generate WOM-related events based on Bingoscape activities
 */
export async function generateWomEvents() {
  // This function would be called on a schedule to generate events
  // based on Bingoscape activities, such as:
  // - Creating competitions for active bingos
  // - Creating competitions for specific skills/bosses based on popular tiles
  // - Creating team competitions for active teams
  // Implementation would depend on specific requirements and business logic
}

