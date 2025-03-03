"use server"

import { db } from "@/server/db"
import { teams, teamTileSubmissions, tiles } from "@/server/db/schema"
import { eq, and, sql } from "drizzle-orm"

export interface TeamPointsOverTime {
  date: string
  xp: number
}

export interface TeamPoints {
  teamId: string
  name: string
  xp: number
}

export interface StatsData {
  teamPoints: TeamPoints[]
  totalPossibleXP: number
}

/**
 * Get total XP for all teams in a bingo and the total possible XP
 */
export async function getAllTeamPointsAndTotal(bingoId: string): Promise<StatsData> {
  // Get all teams for this bingo
  const bingoTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
    })
    .from(teams)
    .innerJoin(tiles, eq(tiles.bingoId, bingoId))
    .groupBy(teams.id, teams.name)

  const teamPoints: TeamPoints[] = []

  // For each team, calculate their total XP
  for (const team of bingoTeams) {
    // Calculate XP from accepted submissions
    const submissionPoints = await db
      .select({
        totalXP: sql<number>`SUM(${tiles.weight})`,
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
      .where(
        and(
          eq(teamTileSubmissions.teamId, team.id),
          eq(tiles.bingoId, bingoId),
          eq(teamTileSubmissions.status, "accepted"),
        ),
      )

    const totalXP = Math.round(submissionPoints[0]?.totalXP ?? 0)

    teamPoints.push({
      teamId: team.id,
      name: team.name,
      xp: totalXP,
    })
  }

  // Calculate total possible XP
  const totalPossibleXP = await db
    .select({
      total: sql<number>`SUM(${tiles.weight})`,
    })
    .from(tiles)
    .where(eq(tiles.bingoId, bingoId))
    .then((result) => Math.round(result[0]?.total ?? 0))

  // Sort by XP in descending order
  teamPoints.sort((a, b) => b.xp - a.xp)

  return {
    teamPoints,
    totalPossibleXP,
  }
}
