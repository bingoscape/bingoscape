"use server"

import { db } from "@/server/db"
import { teams, teamTileSubmissions, tiles, teamMembers, users } from "@/server/db/schema"
import { eq, and, sql, count } from "drizzle-orm"

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
  submissions: number
  fill?: string
}

export interface TeamUserSubmissions {
  teamId: string
  teamName: string
  users: UserSubmission[]
  totalSubmissions: number
}

export interface StatsData {
  teamPoints: TeamPoints[]
  teamSubmissions: TeamSubmissions[]
  teamUserSubmissions: TeamUserSubmissions[]
  totalPossibleXP: number
}

/**
 * Get total XP for all participating teams in a bingo and the total possible XP
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

    // Get submission counts for each user
    const userSubmissions: UserSubmission[] = []
    let totalTeamSubmissions = 0

    for (const member of members) {
      // Count submissions where this user is the reviewer
      const submissionCount = await db
        .select({
          count: count(),
        })
        .from(teamTileSubmissions)
        .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
        .where(
          and(
            eq(teamTileSubmissions.teamId, team.id),
            eq(tiles.bingoId, bingoId),
            eq(teamTileSubmissions.reviewedBy, member.userId),
          ),
        )
        .then((result) => Number(result[0]?.count ?? 0))

      if (submissionCount > 0) {
        userSubmissions.push({
          userId: member.userId,
          name: member.name ?? "Unknown",
          runescapeName: member.runescapeName ?? "Unknown",
          submissions: submissionCount,
        })
        totalTeamSubmissions += submissionCount
      }
    }

    // Add "Other" category for submissions without a reviewer
    const unattributedSubmissions = await db
      .select({
        count: count(),
      })
      .from(teamTileSubmissions)
      .innerJoin(tiles, eq(tiles.id, teamTileSubmissions.tileId))
      .where(
        and(
          eq(teamTileSubmissions.teamId, team.id),
          eq(tiles.bingoId, bingoId),
          sql`${teamTileSubmissions.reviewedBy} IS NULL`,
        ),
      )
      .then((result) => Number(result[0]?.count ?? 0))

    if (unattributedSubmissions > 0) {
      userSubmissions.push({
        userId: "other",
        name: "Other",
        runescapeName: "Other",
        submissions: unattributedSubmissions,
      })
      totalTeamSubmissions += unattributedSubmissions
    }

    // Only add teams that have submissions
    if (userSubmissions.length > 0) {
      teamUserSubmissions.push({
        teamId: team.id,
        teamName: team.name,
        users: userSubmissions,
        totalSubmissions: totalTeamSubmissions,
      })
    }
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
  teamSubmissions.sort((a, b) => b.total - a.total)
  teamUserSubmissions.sort((a, b) => b.totalSubmissions - a.totalSubmissions)

  return {
    teamPoints,
    teamSubmissions,
    teamUserSubmissions,
    totalPossibleXP,
  }
}

