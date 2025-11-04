"use server"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teams, eventParticipants } from "@/server/db/schema"
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

interface SimulatedAnnealingConfig {
  iterations: number // Number of optimization iterations
  initialTemperature: number // Starting temperature
  finalTemperature: number // Ending temperature
  varianceWeights: {
    timezone: number // Weight for timezone variance
    ehp: number // Weight for EHP variance
    ehb: number // Weight for EHB variance
    dailyHours: number // Weight for daily hours variance
  }
}

interface PlayerFeatures {
  userId: string
  timezoneOffset: number // UTC offset in hours
  ehp: number // Imputed with mean if missing
  ehb: number // Imputed with mean if missing
  dailyHours: number // Imputed with mean if missing
}

interface TeamAssignment {
  teams: string[][] // Array of teams, each team is array of userIds
  objective: number // Objective function value (lower is better)
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
 * Convert timezone string to UTC offset in hours
 * Used for calculating actual timezone overlap
 */
function getTimezoneOffset(timezone: string | null | undefined): number {
  if (!timezone) return 0 // Neutral/unknown timezone (UTC)

  // Common timezone UTC offsets (in hours)
  const timezoneOffsets: Record<string, number> = {
    // Americas
    'America/Los_Angeles': -8,
    'America/Vancouver': -8,
    'America/Denver': -7,
    'America/Phoenix': -7,
    'America/Chicago': -6,
    'America/Mexico_City': -6,
    'America/New_York': -5,
    'America/Toronto': -5,
    'America/Sao_Paulo': -3,
    'America/Argentina/Buenos_Aires': -3,

    // Europe
    'Europe/London': 0,
    'Europe/Dublin': 0,
    'Europe/Paris': 1,
    'Europe/Berlin': 1,
    'Europe/Rome': 1,
    'Europe/Madrid': 1,
    'Europe/Amsterdam': 1,
    'Europe/Brussels': 1,
    'Europe/Athens': 2,
    'Europe/Helsinki': 2,
    'Europe/Moscow': 3,

    // Asia/Pacific
    'Asia/Dubai': 4,
    'Asia/Karachi': 5,
    'Asia/Kolkata': 5.5,
    'Asia/Bangkok': 7,
    'Asia/Singapore': 8,
    'Asia/Shanghai': 8,
    'Asia/Hong_Kong': 8,
    'Asia/Tokyo': 9,
    'Asia/Seoul': 9,
    'Australia/Sydney': 11,
    'Australia/Melbourne': 11,
    'Australia/Brisbane': 10,
    'Pacific/Auckland': 13,
  }

  // Try exact match first
  if (timezone in timezoneOffsets) {
    return timezoneOffsets[timezone]!
  }

  // Try partial match
  for (const [key, offset] of Object.entries(timezoneOffsets)) {
    if (timezone.includes(key)) {
      return offset
    }
  }

  return 0 // Default to UTC for unknown timezones
}

/**
 * Calculate timezone overlap score (simplified approach)
 * Higher score = more available during peak times
 * @deprecated - kept for backwards compatibility, use getTimezoneOffset for SA algorithm
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
 * Calculate mean of numeric values, filtering out nulls/undefined
 */
function calculateMean(values: (number | null | undefined)[]): number {
  const validValues = values.filter((v): v is number => v !== null && v !== undefined)
  if (validValues.length === 0) return 0
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
}

/**
 * Prepare player features for simulated annealing
 * Imputes missing values with dataset mean
 */
function preparePlayerFeatures(
  participants: Array<{ userId: string }>,
  metadataMap: Map<string, {
    timezone: string | null
    ehp: number | null
    ehb: number | null
    dailyHoursAvailable: number | null
  }>
): PlayerFeatures[] {
  const allMetadata = Array.from(metadataMap.values())

  // Calculate means for imputation
  const meanEhp = calculateMean(allMetadata.map(m => m.ehp))
  const meanEhb = calculateMean(allMetadata.map(m => m.ehb))
  const meanDailyHours = calculateMean(allMetadata.map(m => m.dailyHoursAvailable))

  return participants.map(p => {
    const metadata = metadataMap.get(p.userId)
    return {
      userId: p.userId,
      timezoneOffset: getTimezoneOffset(metadata?.timezone),
      ehp: metadata?.ehp ?? meanEhp,
      ehb: metadata?.ehb ?? meanEhb,
      dailyHours: metadata?.dailyHoursAvailable ?? meanDailyHours,
    }
  })
}

/**
 * Calculate objective function for team assignment
 * Lower values indicate better balance
 */
function calculateObjective(
  assignment: string[][],
  playerMap: Map<string, PlayerFeatures>,
  config: SimulatedAnnealingConfig
): number {
  const teamStats = assignment.map(team => {
    const players = team.map(userId => playerMap.get(userId)!).filter(p => p !== undefined)
    if (players.length === 0) {
      return { avgTimezone: 0, avgEhp: 0, avgEhb: 0, avgDailyHours: 0 }
    }

    return {
      avgTimezone: players.reduce((sum, p) => sum + p.timezoneOffset, 0) / players.length,
      avgEhp: players.reduce((sum, p) => sum + p.ehp, 0) / players.length,
      avgEhb: players.reduce((sum, p) => sum + p.ehb, 0) / players.length,
      avgDailyHours: players.reduce((sum, p) => sum + p.dailyHours, 0) / players.length,
    }
  })

  // Calculate variance for each metric across teams
  const timezoneVariance = calculateVariance(teamStats.map(s => s.avgTimezone))
  const ehpVariance = calculateVariance(teamStats.map(s => s.avgEhp))
  const ehbVariance = calculateVariance(teamStats.map(s => s.avgEhb))
  const dailyHoursVariance = calculateVariance(teamStats.map(s => s.avgDailyHours))

  // Weighted sum of variances
  return (
    config.varianceWeights.timezone * timezoneVariance +
    config.varianceWeights.ehp * ehpVariance +
    config.varianceWeights.ehb * ehbVariance +
    config.varianceWeights.dailyHours * dailyHoursVariance
  )
}

/**
 * Generate a neighbor configuration by swapping or moving players
 */
function generateNeighbor(assignment: string[][]): string[][] {
  const newAssignment = assignment.map(team => [...team])
  const random = Math.random()

  if (random < 0.7 && newAssignment.length >= 2) {
    // 70% chance: Swap two members between teams
    const team1Idx = Math.floor(Math.random() * newAssignment.length)
    let team2Idx = Math.floor(Math.random() * newAssignment.length)

    // Ensure different teams
    while (team2Idx === team1Idx && newAssignment.length > 1) {
      team2Idx = Math.floor(Math.random() * newAssignment.length)
    }

    const team1 = newAssignment[team1Idx]!
    const team2 = newAssignment[team2Idx]!

    if (team1.length > 0 && team2.length > 0) {
      const player1Idx = Math.floor(Math.random() * team1.length)
      const player2Idx = Math.floor(Math.random() * team2.length)

      const temp = team1[player1Idx]!
      team1[player1Idx] = team2[player2Idx]!
      team2[player2Idx] = temp
    }
  } else if (newAssignment.length >= 2) {
    // 30% chance: Move one member to another team
    const fromTeamIdx = Math.floor(Math.random() * newAssignment.length)
    let toTeamIdx = Math.floor(Math.random() * newAssignment.length)

    // Ensure different teams
    while (toTeamIdx === fromTeamIdx && newAssignment.length > 1) {
      toTeamIdx = Math.floor(Math.random() * newAssignment.length)
    }

    const fromTeam = newAssignment[fromTeamIdx]!
    const toTeam = newAssignment[toTeamIdx]!

    if (fromTeam.length > 0) {
      const playerIdx = Math.floor(Math.random() * fromTeam.length)
      const player = fromTeam.splice(playerIdx, 1)[0]!
      toTeam.push(player)
    }
  }

  return newAssignment
}

/**
 * Simulated annealing optimization for team balancing
 */
function simulatedAnnealing(
  players: PlayerFeatures[],
  numberOfTeams: number,
  config: SimulatedAnnealingConfig
): TeamAssignment {
  // Create player map for quick lookup
  const playerMap = new Map(players.map(p => [p.userId, p]))

  // Initialize with random assignment (round-robin)
  const currentAssignment: string[][] = Array.from({ length: numberOfTeams }, () => [])
  players.forEach((player, idx) => {
    currentAssignment[idx % numberOfTeams]!.push(player.userId)
  })

  let currentObjective = calculateObjective(currentAssignment, playerMap, config)
  let bestAssignment = currentAssignment.map(team => [...team])
  let bestObjective = currentObjective

  // Simulated annealing loop
  for (let iteration = 0; iteration < config.iterations; iteration++) {
    // Calculate temperature using exponential cooling
    const progress = iteration / config.iterations
    const temperature = config.initialTemperature *
      Math.pow(config.finalTemperature / config.initialTemperature, progress)

    // Generate neighbor configuration
    const neighborAssignment = generateNeighbor(currentAssignment)
    const neighborObjective = calculateObjective(neighborAssignment, playerMap, config)

    // Calculate delta
    const delta = neighborObjective - currentObjective

    // Decide whether to accept the neighbor
    const accept = delta <= 0 || Math.random() < Math.exp(-delta / temperature)

    if (accept) {
      // Update current assignment
      currentAssignment.splice(0, currentAssignment.length, ...neighborAssignment)
      currentObjective = neighborObjective

      // Track best solution
      if (neighborObjective < bestObjective) {
        bestAssignment = neighborAssignment.map(team => [...team])
        bestObjective = neighborObjective
      }
    }
  }

  return {
    teams: bestAssignment,
    objective: bestObjective,
  }
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
 * Generate balanced teams using simulated annealing optimization
 */
export async function generateBalancedTeams(
  eventId: string,
  config: {
    teamCount?: number
    teamSize?: number
    generationMethod: "teamCount" | "teamSize"
    teamNamePrefix: string
    weights: BalancingWeights
    simulatedAnnealing?: {
      iterations?: number
      initialTemperature?: number
      finalTemperature?: number
    }
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

  // Calculate number of teams
  const numberOfTeams = config.generationMethod === "teamSize" && config.teamSize
    ? Math.ceil(unassignedParticipants.length / config.teamSize)
    : config.teamCount ?? 2

  // Prepare player features for simulated annealing
  const playerFeatures = preparePlayerFeatures(
    unassignedParticipants.map(p => ({ userId: p.user.id })),
    metadataMap
  )

  // Configure simulated annealing with defaults
  const saConfig: SimulatedAnnealingConfig = {
    iterations: config.simulatedAnnealing?.iterations ?? 1000,
    initialTemperature: config.simulatedAnnealing?.initialTemperature ?? 1.0,
    finalTemperature: config.simulatedAnnealing?.finalTemperature ?? 0.001,
    varianceWeights: {
      timezone: config.weights.timezone,
      ehp: config.weights.ehp,
      ehb: config.weights.ehb,
      dailyHours: config.weights.dailyHours,
    }
  }

  // Run simulated annealing optimization
  const optimizedAssignment = simulatedAnnealing(playerFeatures, numberOfTeams, saConfig)

  // Create teams in database
  const createdTeams: string[] = []
  for (let i = 0; i < numberOfTeams; i++) {
    const teamName = `${config.teamNamePrefix} ${existingTeams.length + i + 1}`
    const team = await createTeam(eventId, teamName)
    if (!team) {
      throw new Error(`Failed to create team: ${teamName}`)
    }
    createdTeams.push(team.id)
  }

  // Assign players to teams based on optimized assignment
  for (let teamIdx = 0; teamIdx < optimizedAssignment.teams.length; teamIdx++) {
    const team = optimizedAssignment.teams[teamIdx]!
    const teamId = createdTeams[teamIdx]!

    for (const userId of team) {
      await addUserToTeam(teamId, userId)
    }
  }

  revalidatePath(`/events/${eventId}`)

  return {
    teamsCreated: numberOfTeams,
    participantsAssigned: unassignedParticipants.length,
    objectiveScore: optimizedAssignment.objective,
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
