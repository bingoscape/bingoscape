import "server-only"

import { db } from "@/server/db"
import { bingos, teams, tiles, teamTileSubmissions } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { getEventReadAccessFor } from "@/server/authz/read"
import {
  getCompletedPatterns,
  type PatternCompletionResult,
} from "@/server/pattern-completion"

export interface TeamPatternData {
  team: {
    id: string
    name: string
  }
  patterns: PatternCompletionResult
  completionPercentage: number
  completedTileIndices: number[]
}

export interface BingoPatternData {
  bingo: {
    id: string
    title: string
    rows: number
    columns: number
  }
  teams: TeamPatternData[]
  totalPossibleBonusXP: number
}

export interface EventPatternCompletionData {
  boards: BingoPatternData[]
}

/**
 * Calculate total possible bonus XP for a bingo board
 */
function calculateTotalPossibleBonusXP(bingo: {
  rows: number
  columns: number
  mainDiagonalBonusXP: number
  antiDiagonalBonusXP: number
  completeBoardBonusXP: number
  rowBonuses: Array<{ bonusXP: number }>
  columnBonuses: Array<{ bonusXP: number }>
}): number {
  let total = 0

  // Add all row bonuses
  for (const rowBonus of bingo.rowBonuses) {
    total += rowBonus.bonusXP
  }

  // Add all column bonuses
  for (const columnBonus of bingo.columnBonuses) {
    total += columnBonus.bonusXP
  }

  // Add diagonal bonuses (only for square boards)
  if (bingo.rows === bingo.columns) {
    total += bingo.mainDiagonalBonusXP
    total += bingo.antiDiagonalBonusXP
  }

  // Add complete board bonus
  total += bingo.completeBoardBonusXP

  return total
}

/**
 * Get pattern completion data for all teams and boards in an event. It lists
 * every Team's completed Tiles, so it is for participants and managers; draft
 * (not visible) Boards are for managers only.
 */
export async function getEventPatternCompletion(
  eventId: string
): Promise<EventPatternCompletionData> {
  const access = await getEventReadAccessFor(eventId, "member-data")
  if (!access) return { boards: [] }

  // Fetch all bingos for the event with pattern bonus data
  const allBingos = await db.query.bingos.findMany({
    where: eq(bingos.eventId, eventId),
    with: {
      rowBonuses: true,
      columnBonuses: true,
    },
    orderBy: (bingos, { asc }) => [asc(bingos.createdAt)],
  })
  const eventBingos = access.isManager
    ? allBingos
    : allBingos.filter((b) => b.visible)

  // Fetch all teams for the event
  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    orderBy: (teams, { asc }) => [asc(teams.name)],
  })

  // Build pattern completion data for each bingo
  const boards: BingoPatternData[] = []

  for (const bingo of eventBingos) {
    // Only process standard bingos (progression boards don't have pattern bonuses)
    if (bingo.bingoType !== "standard") {
      continue
    }

    // Calculate total possible bonus XP for this board
    const totalPossibleBonusXP = calculateTotalPossibleBonusXP(bingo)

    // Skip boards with no pattern bonuses configured
    if (totalPossibleBonusXP === 0) {
      continue
    }

    // Fetch pattern completion for each team
    const teamPatterns: TeamPatternData[] = []

    for (const team of eventTeams) {
      const patterns = await getCompletedPatterns(bingo.id, team.id)

      // Calculate completion percentage
      const completionPercentage =
        totalPossibleBonusXP > 0
          ? Math.round((patterns.totalBonusXP / totalPossibleBonusXP) * 100)
          : 0

      // Fetch completed tile indices for this team
      const completedTiles = await db
        .select({ index: tiles.index })
        .from(teamTileSubmissions)
        .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
        .where(
          and(
            eq(teamTileSubmissions.teamId, team.id),
            eq(tiles.bingoId, bingo.id),
            eq(teamTileSubmissions.status, "completed")
          )
        )

      const completedTileIndices = completedTiles.map((t) => t.index)

      teamPatterns.push({
        team: {
          id: team.id,
          name: team.name,
        },
        patterns,
        completionPercentage,
        completedTileIndices,
      })
    }

    boards.push({
      bingo: {
        id: bingo.id,
        title: bingo.title,
        rows: bingo.rows,
        columns: bingo.columns,
      },
      teams: teamPatterns,
      totalPossibleBonusXP,
    })
  }

  return { boards }
}
