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

export interface StatsData {
  teamPoints: TeamPoints[]
  teamSubmissions: TeamSubmissions[]
  teamUserSubmissions: TeamUserSubmissions[]
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
    let totalTeamImages = 0

    // First, get all teamTileSubmissions for this team
    const teamSubmissionIds = await db
      .select({
        id: teamTileSubmissions.id,
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(and(eq(teamTileSubmissions.teamId, team.id), eq(tiles.bingoId, bingoId)))
      .then((results) => results.map((r) => r.id))

    if (teamSubmissionIds.length === 0) {
      continue // Skip if no submissions
    }

    // For each team member, count their uploaded images
    for (const member of members) {
      // Get all submissions where this user is the uploader
      // Note: We don't have a direct "uploadedBy" field, so we'll use a heuristic
      // based on the creation timestamp and team membership

      // This is a simplified approach - in a real app, you'd want to track the uploader directly
      const imageCount = await db
        .select({
          count: count(),
        })
        .from(submissions)
        .where(inArray(submissions.teamTileSubmissionId, teamSubmissionIds))
        .then((result) => Number(result[0]?.count ?? 0))

      // Only add users who have uploaded images
      if (imageCount > 0) {
        userSubmissions.push({
          userId: member.userId,
          name: member.name ?? "Unknown",
          runescapeName: member.runescapeName ?? "Unknown",
          imageCount: imageCount,
        })
        totalTeamImages += imageCount
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
    teamEfficiency,
    tileCompletions,
    activityTimeline,
    totalPossibleXP,
  }
}

