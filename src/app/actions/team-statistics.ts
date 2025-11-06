"use server"

import { db } from "@/server/db"
import { teams, playerMetadata } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { getTimezoneOffset } from "@/lib/timezones"

/**
 * Individual team statistics including composition and availability metrics
 */
export interface TeamStatistics {
  teamId: string
  teamName: string
  memberCount: number
  averageEHP: number | null
  averageEHB: number | null
  averageCombatLevel: number | null
  averageTotalLevel: number | null
  totalDailyHours: number | null
  timezoneDistribution: Array<{ timezone: string; count: number }>
  timezoneDiversityScore: number
  timezoneHourVariance: number // Hour spread across timezones (range/2)
  metadataCoverage: number // percentage of members with metadata
  membersWithMetadata: number
}

/**
 * Balance metrics showing variance across all teams
 */
export interface BalanceMetrics {
  ehpVariance: number
  ehbVariance: number
  timezoneVariance: number
  dailyHoursVariance: number
  overallBalanceScore: number // 0-100, higher = better balanced
  standardDeviations: {
    ehp: number
    ehb: number
    dailyHours: number
  }
}

/**
 * Metadata coverage statistics for the event
 */
export interface CoverageMetrics {
  totalPlayers: number
  playersWithMetadata: number
  coveragePercentage: number
  specificCoverage: {
    ehp: number // percentage
    ehb: number // percentage
    timezone: number // percentage
    dailyHours: number // percentage
  }
}

/**
 * Complete statistics response
 */
export interface EventTeamStatistics {
  teams: TeamStatistics[]
  balance: BalanceMetrics
  coverage: CoverageMetrics
  totalTeams: number
}

/**
 * Calculate comprehensive team statistics for an event
 */
export async function getEventTeamStatistics(
  eventId: string
): Promise<EventTeamStatistics> {
  // Fetch all teams for the event with their members and metadata
  const eventTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: {
            with: {
              playerMetadata: {
                where: eq(playerMetadata.eventId, eventId),
              },
            },
          },
        },
      },
    },
  })

  // Calculate statistics for each team
  const teamStats: TeamStatistics[] = eventTeams.map((team) => {
    const members = team.teamMembers
    const memberCount = members.length

    // Extract metadata for members who have it
    const membersWithMetadata = members.filter(
      (m) => m.user.playerMetadata.length > 0
    )
    const metadataList = membersWithMetadata.map(
      (m) => m.user.playerMetadata[0]
    )

    // Calculate averages (only for members with metadata)
    const averageEHP =
      metadataList.length > 0
        ? metadataList.reduce(
            (sum, m) => sum + (m?.ehp ? Number(m.ehp) : 0),
            0
          ) / metadataList.filter((m) => m?.ehp != null).length
        : null

    const averageEHB =
      metadataList.length > 0
        ? metadataList.reduce(
            (sum, m) => sum + (m?.ehb ? Number(m.ehb) : 0),
            0
          ) / metadataList.filter((m) => m?.ehb != null).length
        : null

    const averageCombatLevel =
      metadataList.length > 0
        ? metadataList.reduce((sum, m) => sum + (m?.combatLevel ?? 0), 0) /
          metadataList.filter((m) => m?.combatLevel != null).length
        : null

    const averageTotalLevel =
      metadataList.length > 0
        ? metadataList.reduce((sum, m) => sum + (m?.totalLevel ?? 0), 0) /
          metadataList.filter((m) => m?.totalLevel != null).length
        : null

    const totalDailyHours =
      metadataList.length > 0
        ? metadataList.reduce(
            (sum, m) => sum + (m?.dailyHoursAvailable ? Number(m.dailyHoursAvailable) : 0),
            0
          )
        : null

    // Timezone distribution
    const timezoneMap = new Map<string, number>()
    metadataList.forEach((m) => {
      if (m?.timezone) {
        timezoneMap.set(m.timezone, (timezoneMap.get(m.timezone) ?? 0) + 1)
      }
    })
    const timezoneDistribution = Array.from(timezoneMap.entries()).map(
      ([timezone, count]) => ({ timezone, count })
    )

    // Timezone diversity score (0-1, higher = more diverse)
    // Using Shannon entropy normalized
    const timezoneDiversityScore =
      timezoneDistribution.length > 0
        ? calculateDiversityScore(
            timezoneDistribution.map((t) => t.count),
            membersWithMetadata.length
          )
        : 0

    // Calculate timezone hour variance (spread across UTC offsets)
    const timezoneHourVariance = calculateTimezoneHourVariance(timezoneDistribution)

    // Metadata coverage for this team
    const metadataCoverage =
      memberCount > 0
        ? (membersWithMetadata.length / memberCount) * 100
        : 0

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount,
      averageEHP: averageEHP && !isNaN(averageEHP) ? averageEHP : null,
      averageEHB: averageEHB && !isNaN(averageEHB) ? averageEHB : null,
      averageCombatLevel:
        averageCombatLevel && !isNaN(averageCombatLevel)
          ? averageCombatLevel
          : null,
      averageTotalLevel:
        averageTotalLevel && !isNaN(averageTotalLevel)
          ? averageTotalLevel
          : null,
      totalDailyHours:
        totalDailyHours && !isNaN(totalDailyHours) ? totalDailyHours : null,
      timezoneDistribution,
      timezoneDiversityScore,
      timezoneHourVariance,
      metadataCoverage,
      membersWithMetadata: membersWithMetadata.length,
    }
  })

  // Calculate balance metrics across teams
  const balance = calculateBalanceMetrics(teamStats)

  // Calculate overall coverage metrics
  const coverage = calculateCoverageMetrics(eventTeams, eventId)

  return {
    teams: teamStats,
    balance,
    coverage: await coverage,
    totalTeams: eventTeams.length,
  }
}

/**
 * Calculate diversity score using Shannon entropy
 * Returns 0-1 where 1 is perfectly diverse (equal distribution)
 */
function calculateDiversityScore(counts: number[], total: number): number {
  if (counts.length <= 1 || total === 0) return 0

  // Calculate Shannon entropy
  let entropy = 0
  counts.forEach((count) => {
    if (count > 0) {
      const p = count / total
      entropy -= p * Math.log2(p)
    }
  })

  // Normalize by maximum possible entropy (log2 of number of categories)
  const maxEntropy = Math.log2(counts.length)
  return maxEntropy > 0 ? entropy / maxEntropy : 0
}

/**
 * Calculate timezone hour variance (spread across UTC offsets)
 * Returns the range/2 to represent "±X hours" variance
 */
function calculateTimezoneHourVariance(
  timezoneDistribution: Array<{ timezone: string; count: number }>
): number {
  if (timezoneDistribution.length === 0) return 0
  if (timezoneDistribution.length === 1) return 0 // Single timezone = no variance

  // Get UTC offsets for all unique timezones
  const offsets = timezoneDistribution.map((tz) =>
    Math.abs(getTimezoneOffset(tz.timezone))
  )

  // Calculate range (max - min)
  const minOffset = Math.min(...offsets)
  const maxOffset = Math.max(...offsets)
  const range = maxOffset - minOffset

  // Return half the range for "±X hours" representation
  return range / 2
}

/**
 * Calculate balance metrics across all teams
 */
function calculateBalanceMetrics(teams: TeamStatistics[]): BalanceMetrics {
  // Filter teams with valid data
  const teamsWithEHP = teams.filter((t) => t.averageEHP != null)
  const teamsWithEHB = teams.filter((t) => t.averageEHB != null)
  const teamsWithHours = teams.filter((t) => t.totalDailyHours != null)

  // Calculate variance for each metric
  const ehpVariance =
    teamsWithEHP.length > 1
      ? calculateVariance(teamsWithEHP.map((t) => t.averageEHP!))
      : 0

  const ehbVariance =
    teamsWithEHB.length > 1
      ? calculateVariance(teamsWithEHB.map((t) => t.averageEHB!))
      : 0

  const dailyHoursVariance =
    teamsWithHours.length > 1
      ? calculateVariance(teamsWithHours.map((t) => t.totalDailyHours!))
      : 0

  // Timezone variance based on diversity scores
  const timezoneVariance =
    teams.length > 1
      ? calculateVariance(teams.map((t) => t.timezoneDiversityScore))
      : 0

  // Calculate standard deviations
  const ehpStdDev = Math.sqrt(ehpVariance)
  const ehbStdDev = Math.sqrt(ehbVariance)
  const dailyHoursStdDev = Math.sqrt(dailyHoursVariance)

  // Overall balance score (0-100)
  // Lower variance = higher score
  // Normalize variances and average them
  const normalizedEHPVariance = teamsWithEHP.length > 1 ? normalizeVariance(ehpVariance, teamsWithEHP.map((t) => t.averageEHP!)) : 0
  const normalizedEHBVariance = teamsWithEHB.length > 1 ? normalizeVariance(ehbVariance, teamsWithEHB.map((t) => t.averageEHB!)) : 0
  const normalizedHoursVariance = teamsWithHours.length > 1 ? normalizeVariance(dailyHoursVariance, teamsWithHours.map((t) => t.totalDailyHours!)) : 0

  const avgNormalizedVariance =
    (normalizedEHPVariance + normalizedEHBVariance + normalizedHoursVariance + timezoneVariance) / 4

  const overallBalanceScore = Math.max(0, Math.min(100, (1 - avgNormalizedVariance) * 100))

  return {
    ehpVariance,
    ehbVariance,
    timezoneVariance,
    dailyHoursVariance,
    overallBalanceScore: Math.round(overallBalanceScore),
    standardDeviations: {
      ehp: ehpStdDev,
      ehb: ehbStdDev,
      dailyHours: dailyHoursStdDev,
    },
  }
}

/**
 * Calculate variance for a set of values
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map((val) => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
}

/**
 * Normalize variance to 0-1 scale using coefficient of variation
 */
function normalizeVariance(variance: number, values: number[]): number {
  if (values.length === 0 || variance === 0) return 0

  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  if (mean === 0) return 0

  // Coefficient of variation (CV) = std dev / mean
  const cv = Math.sqrt(variance) / Math.abs(mean)

  // Clamp CV to reasonable range (0-1)
  return Math.min(1, cv)
}

/**
 * Calculate metadata coverage statistics
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
async function calculateCoverageMetrics(
  eventTeams: any[],
  _eventId: string
): Promise<CoverageMetrics> {
  // Get all participants for the event
  const allMembers = eventTeams.flatMap((team) => team.teamMembers)
  const totalPlayers = allMembers.length

  // Get all metadata for these players
  const allMetadata = allMembers
    .map((m) => m.user.playerMetadata[0])
    .filter((m) => m != null)

  const playersWithMetadata = allMetadata.length

  // Calculate specific coverage
  const withEHP = allMetadata.filter((m) => m.ehp != null).length
  const withEHB = allMetadata.filter((m) => m.ehb != null).length
  const withTimezone = allMetadata.filter((m) => m.timezone != null).length
  const withDailyHours = allMetadata.filter(
    (m) => m.dailyHoursAvailable != null
  ).length
  /* eslint-enable @typescript-eslint/no-explicit-any */
  /* eslint-enable @typescript-eslint/no-unsafe-return */
  /* eslint-enable @typescript-eslint/no-unsafe-member-access */

  return {
    totalPlayers,
    playersWithMetadata,
    coveragePercentage:
      totalPlayers > 0 ? (playersWithMetadata / totalPlayers) * 100 : 0,
    specificCoverage: {
      ehp: totalPlayers > 0 ? (withEHP / totalPlayers) * 100 : 0,
      ehb: totalPlayers > 0 ? (withEHB / totalPlayers) * 100 : 0,
      timezone: totalPlayers > 0 ? (withTimezone / totalPlayers) * 100 : 0,
      dailyHours:
        totalPlayers > 0 ? (withDailyHours / totalPlayers) * 100 : 0,
    },
  }
}
