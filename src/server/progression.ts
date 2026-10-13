import { and, asc, eq } from "drizzle-orm"

import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import { getUnlockedTiers } from "@/lib/tiers"
import {
  bingos,
  teamTierProgress,
  teamTileSubmissions,
  tierXpRequirements,
  tiles,
} from "@/server/db/schema"

/**
 * Raw readers for progression Boards, used by server code that authorizes the
 * viewer itself (pages, the RuneLite API, the public Event page).
 *
 * Intentionally not a "use server" module: nothing here is callable from the
 * client, and none of it checks a session.
 */

export async function loadTeamTierProgress(teamId: string, bingoId: string) {
  try {
    const tierProgress = await db.query.teamTierProgress.findMany({
      where: and(
        eq(teamTierProgress.teamId, teamId),
        eq(teamTierProgress.bingoId, bingoId)
      ),
      orderBy: asc(teamTierProgress.tier),
    })

    return tierProgress
  } catch (error) {
    logger.error({ error }, "Error fetching team tier progress")
    throw new Error("Failed to fetch team tier progress")
  }
}

/**
 * The Tiles of a progression Board. With a Team, only the Tiles of Tiers the
 * Team has unlocked (Tier 0 always counts) are returned, unless
 * `includeLocked` is set: then every Tile is returned, flagged `tierLocked`.
 */
export async function loadProgressionBingoTiles(
  bingoId: string,
  teamId?: string,
  options: { includeLocked?: boolean } = {}
) {
  try {
    // Get bingo info
    const [bingo] = await db
      .select({ bingoType: bingos.bingoType })
      .from(bingos)
      .where(eq(bingos.id, bingoId))

    if (!bingo || bingo.bingoType !== "progression") {
      throw new Error("Not a progression bingo")
    }

    // Get all tiles
    const allTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingoId),
      with: {
        goals: true,
        teamTileSubmissions: teamId
          ? {
              where: eq(teamTileSubmissions.teamId, teamId),
            }
          : undefined,
      },
      orderBy: [asc(tiles.tier), asc(tiles.index)],
    })

    // If no team specified, return all tiles
    if (!teamId) {
      return allTiles.map((tile) => ({ ...tile, tierLocked: false }))
    }

    // Tier rows are created lazily, so a fresh Team has none: Tier 0 is
    // unlocked regardless of what is stored.
    const tierProgress = await loadTeamTierProgress(teamId, bingoId)
    const unlockedTiers = getUnlockedTiers(tierProgress)

    const flagged = allTiles.map((tile) => ({
      ...tile,
      tierLocked: !unlockedTiers.has(tile.tier),
    }))
    return options.includeLocked
      ? flagged
      : flagged.filter((tile) => !tile.tierLocked)
  } catch (error) {
    logger.error({ error }, "Error fetching progression bingo tiles")
    throw new Error("Failed to fetch progression bingo tiles")
  }
}

export async function loadTierXpRequirements(bingoId: string) {
  try {
    const requirements = await db.query.tierXpRequirements.findMany({
      where: eq(tierXpRequirements.bingoId, bingoId),
      orderBy: asc(tierXpRequirements.tier),
    })
    return requirements
  } catch (error) {
    logger.error({ error }, "Error fetching tier XP requirements")
    throw new Error("Failed to fetch tier XP requirements")
  }
}

