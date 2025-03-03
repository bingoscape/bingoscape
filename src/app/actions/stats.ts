"use server"

import { db } from "@/server/db"
import { teams, teamTileSubmissions, tiles } from "@/server/db/schema"
import { eq, and, gte, lte, sql } from "drizzle-orm"

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
 * Get points over time for a specific team
 */
export async function getTeamPointsOverTime(teamId: string, bingoId: string, days = 14): Promise<TeamPointsOverTime[]> {
  // Calculate the date range
  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  // Get all accepted submissions for this team within the date range
  const acceptedSubmissions = await db
    .select({
      tileId: tiles.id,
      weight: tiles.weight,
      updatedAt: teamTileSubmissions.updatedAt,
    })
    .from(teamTileSubmissions)
    .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
    .where(
      and(
        eq(teamTileSubmissions.teamId, teamId),
        eq(tiles.bingoId, bingoId),
        eq(teamTileSubmissions.status, "accepted"),
        gte(teamTileSubmissions.updatedAt, startDate),
        lte(teamTileSubmissions.updatedAt, endDate),
      ),
    )
    .orderBy(teamTileSubmissions.updatedAt)

  // Generate daily points data
  const dailyPoints: TeamPointsOverTime[] = []
  let cumulativePoints = 0

  // Create a map to track which dates we've already processed
  const dateMap = new Map<string, number>()

  // Process accepted submissions
  for (const submission of acceptedSubmissions) {
    const date = submission.updatedAt.toISOString().split("T")[0]
    const points = submission.weight

    if (dateMap.has(date)) {
      dateMap.set(date, dateMap.get(date)! + points)
    } else {
      dateMap.set(date, points)
    }
  }

  // Convert the map to an array and sort by date
  const sortedDates = Array.from(dateMap.entries()).sort((a, b) => a[0].localeCompare(b[0]))

  // Calculate cumulative points
  for (const [date, points] of sortedDates) {
    cumulativePoints += points
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })

    dailyPoints.push({
      date: formattedDate,
      xp: cumulativePoints,
    })
  }

  // Fill in missing dates with the previous cumulative total
  const result: TeamPointsOverTime[] = []
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate)
    date.setDate(date.getDate() + i)
    const dateStr = date.toISOString().split("T")[0]
    const formattedDate = date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    })

    // Find the last known points value before this date
    let pointsValue = 0
    for (const point of dailyPoints) {
      const pointDate = new Date(point.date)
      if (pointDate <= date) {
        pointsValue = point.xp
      } else {
        break
      }
    }

    result.push({
      date: formattedDate,
      xp: pointsValue,
    })
  }

  return result
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

    const totalXP = Math.round(submissionPoints[0]?.totalXP || 0)

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
    .then((result) => Math.round(result[0]?.total || 0))

  // Sort by XP in descending order
  teamPoints.sort((a, b) => b.xp - a.xp)

  return {
    teamPoints,
    totalPossibleXP,
  }
}
