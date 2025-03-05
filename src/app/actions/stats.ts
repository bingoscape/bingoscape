"use server"

import { db } from "@/server/db"
import { teams, teamTileSubmissions, tiles, teamMembers, users, submissions } from "@/server/db/schema"
import { eq, and, sql, count, desc, asc, gte, lte } from "drizzle-orm"

export interface TeamPointsOverTime {
  date: string
  xp: number
}

export interface TeamPoints {
  teamId: string
  name: string
  xp: number
}

export interface TeamSubmissions {
  teamId: string
  name: string
  total: number
  accepted: number
  pending: number
  declined: number
  requiresInteraction: number
}

export interface UserSubmission {
  userId: string
  name: string
  runescapeName: string
  imageCount: number
  fill?: string
}

export interface TeamUserSubmissions {
  teamId: string
  teamName: string
  users: UserSubmission[]
  totalImages: number
}

export interface TeamEfficiency {
  teamId: string
  name: string
  xp: number
  submissions: number
  efficiency: number // XP per submission
}

export interface TileCompletion {
  tileId: string
  title: string
  weight: number
  completionCount: number
}

export interface ActivityData {
  date: string
  submissions: number
}

export interface StatsData {
  teamPoints: TeamPoints[]
  teamSubmissions: TeamSubmissions[]
  teamUserSubmissions: TeamUserSubmissions[]
  teamUserWeightedSubmissions: TeamUserWeightedSubmissions[]
  teamEfficiency: TeamEfficiency[]
  tileCompletions: TileCompletion[]
  activityTimeline: ActivityData[]
  totalPossibleXP: number
}

export interface UserWeightedSubmission {
  userId: string
  name: string
  runescapeName: string
  totalImages: number
  totalTiles: number
  totalXP: number
  weightedAverage: number // Average images per tile, weighted by XP
}

export interface TeamUserWeightedSubmissions {
  teamId: string
  teamName: string
  users: UserWeightedSubmission[]
}

/**
 * Get comprehensive statistics for a bingo
 */
export async function getAllTeamPointsAndTotal(bingoId: string): Promise<StatsData> {
  // Get all teams that have submissions for this bingo
  const participatingTeams = await db
    .select({
      id: teams.id,
      name: teams.name,
    })
    .from(teams)
    .innerJoin(teamTileSubmissions, eq(teamTileSubmissions.teamId, teams.id))
    .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
    .where(eq(tiles.bingoId, bingoId))
    .groupBy(teams.id, teams.name)

  const teamPoints: TeamPoints[] = []
  const teamSubmissions: TeamSubmissions[] = []
  const teamUserSubmissions: TeamUserSubmissions[] = []
  const teamUserWeightedSubmissions: TeamUserWeightedSubmissions[] = []
  const teamEfficiency: TeamEfficiency[] = []

  // For each participating team, calculate their total XP and submission stats
  for (const team of participatingTeams) {
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

    // Get submission statistics
    const submissionStats = await db
      .select({
        status: teamTileSubmissions.status,
        count: count(),
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(teamTileSubmissions.tileId, tiles.id))
      .where(and(eq(teamTileSubmissions.teamId, team.id), eq(tiles.bingoId, bingoId)))
      .groupBy(teamTileSubmissions.status)

    // Initialize with zeros
    const submissionCounts = {
      total: 0,
      accepted: 0,
      pending: 0,
      declined: 0,
      requiresInteraction: 0,
    }

    // Fill in actual counts
    submissionStats.forEach((stat) => {
      if (stat.status === "accepted") submissionCounts.accepted = Number(stat.count)
      else if (stat.status === "pending") submissionCounts.pending = Number(stat.count)
      else if (stat.status === "declined") submissionCounts.declined = Number(stat.count)
      else if (stat.status === "requires_interaction") submissionCounts.requiresInteraction = Number(stat.count)
    })

    submissionCounts.total =
      submissionCounts.accepted +
      submissionCounts.pending +
      submissionCounts.declined +
      submissionCounts.requiresInteraction

    teamSubmissions.push({
      teamId: team.id,
      name: team.name,
      ...submissionCounts,
    })

    // Calculate team efficiency (XP per submission)
    if (submissionCounts.total > 0) {
      teamEfficiency.push({
        teamId: team.id,
        name: team.name,
        xp: totalXP,
        submissions: submissionCounts.total,
        efficiency: Number.parseFloat((totalXP / submissionCounts.total).toFixed(2)),
      })
    }

    // Get team members
    const members = await db
      .select({
        userId: teamMembers.userId,
        name: users.name,
        runescapeName: users.runescapeName,
      })
      .from(teamMembers)
      .innerJoin(users, eq(users.id, teamMembers.userId))
      .where(eq(teamMembers.teamId, team.id))

    // Get image counts for each user
    const userSubmissions: UserSubmission[] = []
    const userWeightedSubmissions: UserWeightedSubmission[] = []
    let totalTeamImages = 0

    // First, get all teamTileSubmissions for this team
    const teamSubmissionIds = await db
      .select({
        id: teamTileSubmissions.id,
        tileId: teamTileSubmissions.tileId,
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(and(eq(teamTileSubmissions.teamId, team.id), eq(tiles.bingoId, bingoId)))

    if (teamSubmissionIds.length === 0) {
      continue // Skip if no submissions
    }

    // Get tile weights for XP calculations
    const tileWeights = await db
      .select({
        id: tiles.id,
        weight: tiles.weight,
      })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId))
      .then((results) => {
        const weightMap = new Map<string, number>()
        results.forEach((tile) => weightMap.set(tile.id, tile.weight))
        return weightMap
      })

    // For each team member, calculate weighted submission metrics
    for (const member of members) {
      // Track per-tile submissions for this user
      const userTileSubmissions = new Map<string, { images: number; xp: number }>()
      let totalUserImages = 0
      let totalUserTiles = 0
      let totalUserXP = 0

      // For each team submission, count images by this user per tile
      for (const submission of teamSubmissionIds) {
        const imageCount = await db
          .select({
            count: count(),
          })
          .from(submissions)
          .where(
            and(
              eq(submissions.teamTileSubmissionId, submission.id),
              // In a real app, you'd have a direct way to identify the uploader
              // This is a simplified approach
            ),
          )
          .then((result) => Number(result[0]?.count ?? 0))

        if (imageCount > 0) {
          const tileXP = tileWeights.get(submission.tileId) || 0

          // Add to user's tile-specific counts
          if (!userTileSubmissions.has(submission.tileId)) {
            userTileSubmissions.set(submission.tileId, { images: 0, xp: tileXP })
            totalUserTiles++
            totalUserXP += tileXP
          }

          const tileData = userTileSubmissions.get(submission.tileId)!
          tileData.images += imageCount
          userTileSubmissions.set(submission.tileId, tileData)

          totalUserImages += imageCount
        }
      }

      // Calculate weighted average (if user has submissions)
      if (totalUserTiles > 0 && totalUserXP > 0) {
        // Calculate weighted average: sum(images_per_tile * tile_xp) / sum(tile_xp)
        let weightedSum = 0
        for (const [_, tileData] of userTileSubmissions.entries()) {
          weightedSum += tileData.images * tileData.xp
        }

        const weightedAverage = Number.parseFloat((weightedSum / totalUserXP).toFixed(2))

        // Add to user weighted submissions
        userWeightedSubmissions.push({
          userId: member.userId,
          name: member.name ?? "Unknown",
          runescapeName: member.runescapeName ?? "Unknown",
          totalImages: totalUserImages,
          totalTiles: totalUserTiles,
          totalXP: totalUserXP,
          weightedAverage: weightedAverage,
        })

        // Also add to regular image count for backward compatibility
        userSubmissions.push({
          userId: member.userId,
          name: member.name ?? "Unknown",
          runescapeName: member.runescapeName ?? "Unknown",
          imageCount: totalUserImages,
        })

        totalTeamImages += totalUserImages
      }
    }

    // Only add teams that have image uploads
    if (userSubmissions.length > 0) {
      teamUserSubmissions.push({
        teamId: team.id,
        teamName: team.name,
        users: userSubmissions,
        totalImages: totalTeamImages,
      })
    }

    // Only add teams that have weighted submissions
    if (userWeightedSubmissions.length > 0) {
      // Sort by weighted average in descending order
      userWeightedSubmissions.sort((a, b) => b.weightedAverage - a.weightedAverage)

      teamUserWeightedSubmissions.push({
        teamId: team.id,
        teamName: team.name,
        users: userWeightedSubmissions,
      })
    }
  }

  // Get tile completion statistics
  const tileCompletions = await db
    .select({
      tileId: tiles.id,
      title: tiles.title,
      weight: tiles.weight,
      completionCount: count(teamTileSubmissions.id),
    })
    .from(tiles)
    .leftJoin(
      teamTileSubmissions,
      and(eq(teamTileSubmissions.tileId, tiles.id), eq(teamTileSubmissions.status, "accepted")),
    )
    .where(eq(tiles.bingoId, bingoId))
    .groupBy(tiles.id, tiles.title, tiles.weight)
    .orderBy(desc(count(teamTileSubmissions.id)))
    .then((results) =>
      results.map((r) => ({
        tileId: r.tileId,
        title: r.title,
        weight: r.weight,
        completionCount: Number(r.completionCount),
      })),
    )

  // Get activity timeline (submissions per day)
  const now = new Date()
  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(now.getDate() - 30)

  const activityData = await db
    .select({
      date: sql<string>`DATE(${teamTileSubmissions.createdAt})`,
      count: count(),
    })
    .from(teamTileSubmissions)
    .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
    .where(
      and(
        eq(tiles.bingoId, bingoId),
        gte(teamTileSubmissions.createdAt, thirtyDaysAgo),
        lte(teamTileSubmissions.createdAt, now),
      ),
    )
    .groupBy(sql`DATE(${teamTileSubmissions.createdAt})`)
    .orderBy(asc(sql`DATE(${teamTileSubmissions.createdAt})`))

  const activityTimeline: ActivityData[] = activityData.map((item) => ({
    date: item.date,
    submissions: Number(item.count),
  }))

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
  teamSubmissions.sort((a, b) => b.total - a.total)
  teamUserSubmissions.sort((a, b) => b.totalImages - a.totalImages)
  teamEfficiency.sort((a, b) => b.efficiency - a.efficiency)

  return {
    teamPoints,
    teamSubmissions,
    teamUserSubmissions,
    teamUserWeightedSubmissions,
    teamEfficiency,
    tileCompletions,
    activityTimeline,
    totalPossibleXP,
  }
}

