"use server"

import { db } from "@/server/db"
import { teams, teamTileSubmissions, tiles, teamMembers, users, submissions } from "@/server/db/schema"
import { eq, and, sql, count, inArray, desc, asc, gte, lte } from "drizzle-orm"

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

export interface UserWeightedSubmission {
  userId: string
  name: string
  runescapeName: string
  totalImages: number
  totalTiles: number
  totalXP: number
  weightedAverage: number // Average images per tile, weighted by XP
  contributionScore: number // Contribution score based on relative submissions and tile weight
}

export interface TeamUserWeightedSubmissions {
  teamId: string
  teamName: string
  users: UserWeightedSubmission[]
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

    // Get all teamTileSubmissions for this team with status
    const teamSubmissionData = await db
      .select({
        id: teamTileSubmissions.id,
        tileId: teamTileSubmissions.tileId,
        status: teamTileSubmissions.status,
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(and(eq(teamTileSubmissions.teamId, team.id), eq(tiles.bingoId, bingoId)))

    if (teamSubmissionData.length === 0) {
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

    // Get all submissions with user info
    const allSubmissions = await db
      .select({
        id: submissions.id,
        teamTileSubmissionId: submissions.teamTileSubmissionId,
        submittedBy: submissions.submittedBy,
        tileId: teamTileSubmissions.tileId,
      })
      .from(submissions)
      .innerJoin(teamTileSubmissions, eq(submissions.teamTileSubmissionId, teamTileSubmissions.id))
      .where(
        and(
          eq(teamTileSubmissions.teamId, team.id),
          inArray(
            teamTileSubmissions.id,
            teamSubmissionData.map((s) => s.id),
          ),
        ),
      )

    // Group submissions by tile and submission ID to calculate total submissions per tile
    const tileSubmissionCounts = new Map<string, number>()
    const tileSubmissionMap = new Map<string, Map<string, number>>()

    // First, count total submissions per tile
    for (const submission of allSubmissions) {
      const tileId = submission.tileId
      const submissionId = submission.teamTileSubmissionId

      // Count total submissions per tile
      tileSubmissionCounts.set(tileId, (tileSubmissionCounts.get(tileId) ?? 0) + 1)

      // Group by tile and submission
      if (!tileSubmissionMap.has(tileId)) {
        tileSubmissionMap.set(tileId, new Map())
      }

      const submissionMap = tileSubmissionMap.get(tileId)!
      submissionMap.set(submissionId, (submissionMap.get(submissionId) ?? 0) + 1)
    }

    // Process user submissions
    const userSubmissions: UserSubmission[] = []
    const userWeightedSubmissions: UserWeightedSubmission[] = []
    let totalTeamImages = 0

    // Create a map to track per-user, per-tile submissions and contribution scores
    const userTileSubmissionsMap = new Map<
      string,
      Map<
        string,
        {
          images: number
          xp: number
          totalTileSubmissions: number
          contributionScore: number
        }
      >
    >()

    // Process all submissions to build the user-tile map
    for (const submission of allSubmissions) {
      const userId = submission.submittedBy
      const tileId = submission.tileId
      const submissionId = submission.teamTileSubmissionId
      const tileXP = tileWeights.get(tileId) ?? 0

      // Get the submission status
      const submissionStatus = teamSubmissionData.find((s) => s.id === submissionId)?.status

      // Only count accepted submissions for the weighted average
      if (submissionStatus === "accepted") {
        // Initialize user map if needed
        if (!userTileSubmissionsMap.has(userId)) {
          userTileSubmissionsMap.set(userId, new Map())
        }

        const userMap = userTileSubmissionsMap.get(userId)!

        // Initialize tile data if needed
        if (!userMap.has(tileId)) {
          const totalTileSubmissions = tileSubmissionCounts.get(tileId) ?? 1
          userMap.set(tileId, {
            images: 0,
            xp: tileXP,
            totalTileSubmissions,
            contributionScore: 0,
          })
        }

        // Increment image count
        const tileData = userMap.get(tileId)!
        tileData.images += 1

        // Calculate contribution score for this tile
        // Formula: (user's submissions / total submissions for tile) * tile XP
        const totalTileSubmissions = tileData.totalTileSubmissions
        tileData.contributionScore = (tileData.images / totalTileSubmissions) * tileXP

        userMap.set(tileId, tileData)
      }
    }

    // Process the map to generate statistics
    for (const member of members) {
      const userId = member.userId
      const userMap = userTileSubmissionsMap.get(userId)

      if (!userMap || userMap.size === 0) {
        continue // Skip users with no submissions
      }

      let totalUserImages = 0
      let totalUserTiles = 0
      let totalUserXP = 0
      let weightedSum = 0
      let totalContributionScore = 0

      // Calculate totals
      for (const [tileId, tileData] of userMap.entries()) {
        totalUserImages += tileData.images
        totalUserTiles += 1
        totalUserXP += tileData.xp
        weightedSum += tileData.images * tileData.xp
        totalContributionScore += tileData.contributionScore
      }

      // Calculate weighted average
      const weightedAverage = totalUserXP > 0 ? Number.parseFloat((weightedSum / totalUserXP).toFixed(2)) : 0

      // Add to user weighted submissions
      userWeightedSubmissions.push({
        userId,
        name: member.name ?? "Unknown",
        runescapeName: member.runescapeName ?? "Unknown",
        totalImages: totalUserImages,
        totalTiles: totalUserTiles,
        totalXP: totalUserXP,
        weightedAverage,
        contributionScore: Number.parseFloat(totalContributionScore.toFixed(2)),
      })

      // Also add to regular image count for backward compatibility
      userSubmissions.push({
        userId,
        name: member.name ?? "Unknown",
        runescapeName: member.runescapeName ?? "Unknown",
        imageCount: totalUserImages,
      })

      totalTeamImages += totalUserImages
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
      // Sort by contribution score in descending order
      userWeightedSubmissions.sort((a, b) => b.contributionScore - a.contributionScore)

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

