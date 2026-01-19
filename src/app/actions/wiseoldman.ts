"use server"

import { WOMClient } from "@wise-old-man/utils"
import { logger } from "@/lib/logger";

// Initialize WiseOldMan client with optional API key for higher rate limits
const womClient = new WOMClient({
  apiKey: process.env.WISEOLDMAN_API_KEY,
  userAgent: "Bingoscape/1.0.0",
})

export interface WOMPlayerData {
  ehp: number
  ehb: number
  combatLevel: number
  totalLevel: number
  skills: Record<string, { level: number; experience: number; rank: number; ehp: number }>
  bosses: Record<string, { kills: number; rank: number; ehb: number }>
}

export interface FetchWOMDataResult {
  success: boolean
  data?: WOMPlayerData
  error?: string
}

/**
 * Fetch player data from WiseOldMan API
 * Returns EHP, EHB, combat level, total level, skills, and boss KC
 */
export async function fetchPlayerDataFromWOM(
  runescapeName: string,
): Promise<FetchWOMDataResult> {
  if (!runescapeName || runescapeName.trim() === "") {
    return {
      success: false,
      error: "RuneScape name is required",
    }
  }

  try {
    // Fetch player details from WiseOldMan
    const player = await womClient.players.getPlayerDetails(runescapeName.trim())

    // Check if player has latest snapshot data
    if (!player.latestSnapshot?.data) {
      return {
        success: false,
        error: "Player data not available. Try updating the player on WiseOldMan first.",
      }
    }

    const snapshot = player.latestSnapshot.data

    // Extract skills data
    const skills: Record<string, { level: number; experience: number; rank: number; ehp: number }> = {}
    if (snapshot.skills) {
      for (const [skillName, skillData] of Object.entries(snapshot.skills)) {
        skills[skillName] = {
          level: skillData.level,
          experience: skillData.experience,
          rank: skillData.rank,
          ehp: skillData.ehp,
        }
      }
    }

    // Extract bosses data (filter out entries with -1 kills)
    const bosses: Record<string, { kills: number; rank: number; ehb: number }> = {}
    if (snapshot.bosses) {
      for (const [bossName, bossData] of Object.entries(snapshot.bosses)) {
        if (bossData.kills > 0) {
          bosses[bossName] = {
            kills: bossData.kills,
            rank: bossData.rank,
            ehb: bossData.ehb,
          }
        }
      }
    }

    return {
      success: true,
      data: {
        ehp: player.ehp,
        ehb: player.ehb,
        combatLevel: player.combatLevel,
        totalLevel: snapshot.skills?.overall?.level ?? 0,
        skills,
        bosses,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error fetching WiseOldMan data:", error)

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes("404") || error.message.includes("not found")) {
        return {
          success: false,
          error: "Player not found on WiseOldMan. They may need to be tracked first at wiseoldman.net",
        }
      }

      if (error.message.includes("429") || error.message.includes("rate limit")) {
        return {
          success: false,
          error: "Rate limit exceeded. Please try again in a few minutes.",
        }
      }
    }

    return {
      success: false,
      error: "Failed to fetch player data from WiseOldMan. Please try again later.",
    }
  }
}

/**
 * Trigger a player update on WiseOldMan (pulls fresh data from OSRS hiscores)
 * Note: This should be used sparingly due to rate limits
 */
export async function updatePlayerOnWOM(runescapeName: string): Promise<FetchWOMDataResult> {
  if (!runescapeName || runescapeName.trim() === "") {
    return {
      success: false,
      error: "RuneScape name is required",
    }
  }

  try {
    // Trigger update on WiseOldMan (this will fetch from OSRS hiscores)
    await womClient.players.updatePlayer(runescapeName.trim())

    // Wait a moment for the update to process
    await new Promise((resolve) => setTimeout(resolve, 2000))

    // Fetch the updated data
    return await fetchPlayerDataFromWOM(runescapeName)
  } catch (error) {
    logger.error({ error }, "Error updating WiseOldMan data:", error)

    return {
      success: false,
      error: "Failed to update player on WiseOldMan. Please try again later.",
    }
  }
}
