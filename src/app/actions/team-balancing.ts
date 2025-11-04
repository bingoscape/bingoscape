"use server"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teams, teamMembers, eventParticipants, users } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getEventParticipantMetadata, calculateMetadataCoverage } from "./player-metadata"
import { createTeam, addUserToTeam } from "./team"

interface BalancingWeights {
  ehp: number // 0-1
  ehb: number // 0-1
  timezone: number // 0-1
  dailyHours: number // 0-1
  skillLevel: number // 0-1
}

interface ScoredParticipant {
  userId: string
  userName: string | null
  runescapeName: string | null
  score: number
  breakdown: {
    ehp: number
    ehb: number
    timezone: number
    dailyHours: number
    skillLevel: number
  }
}

/**
 * Skill level mapping to numeric values
 */
const SKILL_LEVEL_SCORES: Record<string, number> = {
  beginner: 0.25,
  intermediate: 0.5,
  advanced: 0.75,
  expert: 1.0,
}

/**
 * Normalize a value using percentile ranking
 */
function percentileNormalize(value: number | null | undefined, allValues: (number | null | undefined)[]): number {
  if (value === null || value === undefined) return 0.5 // Neutral score for missing data

  const validValues = allValues.filter((v): v is number => v !== null && v !== undefined)
  if (validValues.length === 0) return 0.5

  const sortedValues = [...validValues].sort((a, b) => a - b)
  const rank = sortedValues.filter(v => v <= value).length
  return rank / sortedValues.length
}

/**
 * Calculate timezone overlap score (simplified approach)
 * Higher score = more available during peak times
 */
function calculateTimezoneScore(timezone: string | null | undefined): number {
  if (!timezone) return 0.5 // Neutral for missing timezone

  // Simplified: Just map known timezones to approximate scores
  // In production, you'd want more sophisticated overlap calculation
  const timezoneScores: Record<string, number> = {
    'America/Los_Angeles': 0.6,
    'America/Denver': 0.65,
    'America/Chicago': 0.7,
    'America/New_York': 0.75,
    'Europe/London': 0.8,
    'Europe/Paris': 0.85,
    'Europe/Berlin': 0.85,
    'Australia/Sydney': 0.4,
    'Asia/Tokyo': 0.3,
  }

  // Try to find a match or return neutral
  for (const [key, score] of Object.entries(timezoneScores)) {
    if (timezone.includes(key)) return score
  }

  return 0.5 // Neutral for unknown timezones
}

/**
 * Calculate composite player score based on metadata and weights
 */
function calculatePlayerScore(
  metadata: {
    ehp: number | null
    ehb: number | null
    timezone: string | null
    dailyHoursAvailable: number | null
    skillLevel: "beginner" | "intermediate" | "advanced" | "expert" | null
  },
  allMetadata: Array<typeof metadata>,
  weights: BalancingWeights
): { score: number; breakdown: ScoredParticipant['breakdown'] } {
  // Normalize each attribute
  const ehpScore = percentileNormalize(
    metadata.ehp,
    allMetadata.map(m => m.ehp)
  )

  const ehbScore = percentileNormalize(
    metadata.ehb,
    allMetadata.map(m => m.ehb)
  )

  const timezoneScore = calculateTimezoneScore(metadata.timezone)

  const dailyHoursScore = percentileNormalize(
    metadata.dailyHoursAvailable,
    allMetadata.map(m => m.dailyHoursAvailable)
  )

  const skillScore = metadata.skillLevel
    ? (SKILL_LEVEL_SCORES[metadata.skillLevel] ?? 0.5)
    : 0.5

  // Apply weights and calculate composite score
  const breakdown = {
    ehp: ehpScore * weights.ehp,
    ehb: ehbScore * weights.ehb,
    timezone: timezoneScore * weights.timezone,
    dailyHours: dailyHoursScore * weights.dailyHours,
    skillLevel: skillScore * weights.skillLevel,
  }

  // Calculate total (normalize by sum of weights)
  const totalWeight = weights.ehp + weights.ehb + weights.timezone + weights.dailyHours + weights.skillLevel
  const score = totalWeight > 0
    ? (breakdown.ehp + breakdown.ehb + breakdown.timezone + breakdown.dailyHours + breakdown.skillLevel) / totalWeight
    : 0.5

  return { score, breakdown }
}

/**
 * Check if balanced team generation is available for an event
 * Returns true if at least 50% of participants have metadata
 */
export async function canUseBalancedGeneration(eventId: string): Promise<boolean> {
  const coverage = await calculateMetadataCoverage(eventId)
  return coverage >= 50
}

/**
 * Generate balanced teams using snake draft algorithm
 */
export async function generateBalancedTeams(
  eventId: string,
  config: {
    teamCount?: number
    teamSize?: number
    generationMethod: "teamCount" | "teamSize"
    teamNamePrefix: string
    weights: BalancingWeights
  }
) {
  const session = await getServerAuthSession()
  if (!session?.user?.id) {
    throw new Error("Unauthorized: You must be logged in")
  }

  // Check management rights
  const participant = await db.query.eventParticipants.findFirst({
    where: and(
      eq(eventParticipants.eventId, eventId),
      eq(eventParticipants.userId, session.user.id)
    ),
  })

  if (!participant || (participant.role !== "management" && participant.role !== "admin")) {
    throw new Error("Unauthorized: You must be a management user for this event")
  }

  // Get all event participants
  const allParticipants = await db.query.eventParticipants.findMany({
    where: eq(eventParticipants.eventId, eventId),
    with: {
      user: {
        columns: {
          id: true,
          name: true,
          runescapeName: true,
          image: true,
        },
      },
    },
  })

  // Get existing teams to find unassigned participants
  const existingTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: true,
        },
      },
    },
  })

  // Filter out already assigned participants
  const assignedUserIds = new Set(
    existingTeams.flatMap(team => team.teamMembers.map(member => member.user.id))
  )

  const unassignedParticipants = allParticipants.filter(
    p => !assignedUserIds.has(p.user.id)
  )

  if (unassignedParticipants.length === 0) {
    throw new Error("No unassigned participants to assign to teams")
  }

  // Get metadata for all participants
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(
    metadata.map(m => [m.userId, m])
  )

  // Calculate scores for all unassigned participants
  const allMetadata = unassignedParticipants
    .map(p => metadataMap.get(p.user.id))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)
  const scoredParticipants: ScoredParticipant[] = unassignedParticipants.map(p => {
    const userMetadata = metadataMap.get(p.user.id)
    const { score, breakdown } = userMetadata
      ? calculatePlayerScore(userMetadata, allMetadata, config.weights)
      : { score: 0.5, breakdown: { ehp: 0.5, ehb: 0.5, timezone: 0.5, dailyHours: 0.5, skillLevel: 0.5 } }

    return {
      userId: p.user.id,
      userName: p.user.name,
      runescapeName: p.user.runescapeName,
      score,
      breakdown,
    }
  })

  // Sort by score (descending)
  scoredParticipants.sort((a, b) => b.score - a.score)

  // Calculate number of teams
  const numberOfTeams = config.generationMethod === "teamSize" && config.teamSize
    ? Math.ceil(scoredParticipants.length / config.teamSize)
    : config.teamCount ?? 2

  // Create teams
  const createdTeams: string[] = []
  for (let i = 0; i < numberOfTeams; i++) {
    const teamName = `${config.teamNamePrefix} ${existingTeams.length + i + 1}`
    const team = await createTeam(eventId, teamName)
    if (!team) {
      throw new Error(`Failed to create team: ${teamName}`)
    }
    createdTeams.push(team.id)
  }

  // Snake draft distribution
  let currentTeamIndex = 0
  let direction = 1 // 1 = forward, -1 = backward

  for (const participant of scoredParticipants) {
    await addUserToTeam(createdTeams[currentTeamIndex]!, participant.userId)

    // Move to next team with snake pattern
    if (currentTeamIndex === numberOfTeams - 1 && direction === 1) {
      direction = -1 // Reverse at end
    } else if (currentTeamIndex === 0 && direction === -1) {
      direction = 1 // Reverse at start
    } else {
      currentTeamIndex += direction
    }
  }

  revalidatePath(`/events/${eventId}`)

  return {
    teamsCreated: numberOfTeams,
    participantsAssigned: scoredParticipants.length,
    averageScore: scoredParticipants.reduce((sum, p) => sum + p.score, 0) / scoredParticipants.length,
  }
}

/**
 * Calculate balance metrics for existing teams
 */
export async function calculateTeamBalanceMetrics(eventId: string) {
  const existingTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: true,
        },
      },
    },
  })

  if (existingTeams.length === 0) {
    return null
  }

  // Get metadata
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(metadata.map(m => [m.userId, m]))

  // Calculate average score per team (using equal weights for display)
  const defaultWeights: BalancingWeights = {
    ehp: 0.2,
    ehb: 0.2,
    timezone: 0.2,
    dailyHours: 0.2,
    skillLevel: 0.2,
  }

  const allMetadata = existingTeams
    .flatMap(t => t.teamMembers.map(m => metadataMap.get(m.user.id)))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)

  const teamScores = existingTeams.map(team => {
    const memberScores = team.teamMembers.map(member => {
      const userMetadata = metadataMap.get(member.user.id)
      const { score } = userMetadata
        ? calculatePlayerScore(userMetadata, allMetadata, defaultWeights)
        : { score: 0.5 }
      return score
    })

    const averageScore = memberScores.length > 0
      ? memberScores.reduce((sum, s) => sum + s, 0) / memberScores.length
      : 0

    return {
      teamId: team.id,
      teamName: team.name,
      memberCount: team.teamMembers.length,
      averageScore,
    }
  })

  // Calculate variance
  const overallAverage = teamScores.reduce((sum, t) => sum + t.averageScore, 0) / teamScores.length
  const variance = teamScores.reduce(
    (sum, t) => sum + Math.pow(t.averageScore - overallAverage, 2),
    0
  ) / teamScores.length

  return {
    teams: teamScores,
    overallAverage,
    variance,
    standardDeviation: Math.sqrt(variance),
  }
}
