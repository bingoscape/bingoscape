"use server"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { teams, eventParticipants } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { getEventParticipantMetadata, calculateMetadataCoverage } from "./player-metadata"
import { createTeam, addUserToTeam } from "./team"
import { SA_STANDARD_CONFIG, SA_FORMULAS } from "@/lib/simulated-annealing-config"

interface BalancingWeights {
  ehp: number // 0-1
  ehb: number // 0-1
  timezone: number // 0-1
  dailyHours: number // 0-1
}

/**
 * Extended simulated annealing configuration
 * Supports both standard configuration and legacy options
 */
interface SimulatedAnnealingConfig {
  iterations: number // Number of optimization iterations
  initialTemperature: number // Starting temperature
  finalTemperature: number // Ending temperature

  // Variance weights for objective function
  varianceWeights: {
    timezone: number // Weight for timezone variance
    ehp: number // Weight for EHP variance
    ehb: number // Weight for EHB variance
    dailyHours: number // Weight for daily hours variance
    teamSize: number // Weight for team size variance (promotes equal-sized teams)
  }

  // New: Random seed for reproducibility (optional)
  randomSeed?: number

  // New: Stagnation limit for early termination (optional)
  stagnationLimit?: number

  // New: Move operator probabilities (optional, defaults to 0.7/0.3)
  moves?: {
    swapProbability: number
    moveProbability: number
  }
}

interface PlayerFeatures {
  userId: string
  timezoneOffset: number // UTC offset in hours (kept for reference)
  timezoneAngle: number // Timezone converted to radians for circular statistics
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
  }
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

  // Apply weights and calculate composite score
  const breakdown = {
    ehp: ehpScore * weights.ehp,
    ehb: ehbScore * weights.ehb,
    timezone: timezoneScore * weights.timezone,
    dailyHours: dailyHoursScore * weights.dailyHours,
  }

  // Calculate total (normalize by sum of weights)
  const totalWeight = weights.ehp + weights.ehb + weights.timezone + weights.dailyHours
  const score = totalWeight > 0
    ? (breakdown.ehp + breakdown.ehb + breakdown.timezone + breakdown.dailyHours) / totalWeight
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
 * Calculate standard deviation of an array of numbers
 */
function calculateStandardDeviation(values: number[]): number {
  return Math.sqrt(calculateVariance(values))
}

/**
 * Calculate z-score for a value given population statistics
 * Formula: z = (x - μ) / σ
 * Returns 0 if standard deviation is 0 (no variance in population)
 */
function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0
  return (value - mean) / stdDev
}

/**
 * Calculate circular variance for angles in radians
 * Used for timezone distribution within teams
 *
 * Formula:
 *   R = √(S² + C²)  where S = Σsin(θ)/n, C = Σcos(θ)/n
 *   CircularVariance = 1 - R
 *
 * Range: [0, 1]
 *   0 = all angles identical (perfect cohesion)
 *   1 = angles uniformly distributed (maximum dispersion)
 *
 * @param angles - Array of angles in radians
 * @returns Circular variance value between 0 and 1
 */
function calculateCircularVariance(angles: number[]): number {
  if (angles.length === 0) return 0
  if (angles.length === 1) return 0 // Single angle has no variance

  const sumSin = angles.reduce((sum, angle) => sum + Math.sin(angle), 0)
  const sumCos = angles.reduce((sum, angle) => sum + Math.cos(angle), 0)

  const S = sumSin / angles.length
  const C = sumCos / angles.length

  // Mean resultant length (R)
  const R = Math.sqrt(S * S + C * C)

  // Circular variance = 1 - R
  return 1 - R
}

/**
 * Global statistics for normalizing features using z-scores
 */
interface GlobalStats {
  ehp: { mean: number; stdDev: number }
  ehb: { mean: number; stdDev: number }
  dailyHours: { mean: number; stdDev: number }
  // Note: Timezone uses circular statistics, not z-scores
}

/**
 * Calculate global statistics for all players
 * Used to normalize features with z-scores during objective calculation
 *
 * @param players - All player features in the dataset
 * @returns Global mean and standard deviation for each metric
 */
function calculateGlobalStats(players: PlayerFeatures[]): GlobalStats {
  const ehpValues = players.map(p => p.ehp)
  const ehbValues = players.map(p => p.ehb)
  const dailyHoursValues = players.map(p => p.dailyHours)

  return {
    ehp: {
      mean: calculateMean(ehpValues),
      stdDev: calculateStandardDeviation(ehpValues),
    },
    ehb: {
      mean: calculateMean(ehbValues),
      stdDev: calculateStandardDeviation(ehbValues),
    },
    dailyHours: {
      mean: calculateMean(dailyHoursValues),
      stdDev: calculateStandardDeviation(dailyHoursValues),
    },
  }
}

/**
 * Convert timezone UTC offset (in hours) to angle in radians
 * Formula: θ = (offset / 24) × 2π
 *
 * Examples:
 *   UTC (0h) → 0 radians
 *   UTC+6 (6h) → π/2 radians (90°)
 *   UTC+12 (12h) → π radians (180°)
 *   UTC-12 (-12h) → -π radians (-180°)
 *
 * @param offset - UTC offset in hours (-12 to +14)
 * @returns Angle in radians (-π to +π)
 */
function timezoneOffsetToAngle(offset: number): number {
  return (offset / 24) * 2 * Math.PI
}

/**
 * Prepare player features for simulated annealing
 * Imputes missing values with dataset mean
 * Converts timezone offsets to angles for circular statistics
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
    const timezoneOffset = getTimezoneOffset(metadata?.timezone)

    return {
      userId: p.userId,
      timezoneOffset: timezoneOffset,
      timezoneAngle: timezoneOffsetToAngle(timezoneOffset),
      ehp: metadata?.ehp ?? meanEhp,
      ehb: metadata?.ehb ?? meanEhb,
      dailyHours: metadata?.dailyHoursAvailable ?? meanDailyHours,
    }
  })
}

/**
 * Calculate objective function for team assignment
 * Lower values indicate better balance
 *
 * Uses z-score normalization and circular variance for timezone
 * Formula: E(S) = Σ(w_i * Var_i(z-scores)) + w_tz * CircVar(timezones) + w_size * Var(team_sizes)
 *
 * @param assignment - Team assignments (array of player ID arrays)
 * @param playerMap - Map of player IDs to their features
 * @param config - Simulated annealing configuration
 * @param globalStats - Global statistics for z-score normalization
 * @returns Objective value (lower is better)
 */
function calculateObjective(
  assignment: string[][],
  playerMap: Map<string, PlayerFeatures>,
  config: SimulatedAnnealingConfig,
  globalStats: GlobalStats
): number {
  // Calculate team-level statistics
  const teamStats = assignment.map(team => {
    const players = team.map(userId => playerMap.get(userId)!).filter(p => p !== undefined)
    if (players.length === 0) {
      return {
        avgEhp: 0,
        avgEhb: 0,
        avgDailyHours: 0,
        timezoneAngles: [] as number[],
      }
    }

    return {
      avgEhp: players.reduce((sum, p) => sum + p.ehp, 0) / players.length,
      avgEhb: players.reduce((sum, p) => sum + p.ehb, 0) / players.length,
      avgDailyHours: players.reduce((sum, p) => sum + p.dailyHours, 0) / players.length,
      timezoneAngles: players.map(p => p.timezoneAngle),
    }
  })

  // Convert team averages to z-scores
  const ehpZScores = teamStats.map(s =>
    calculateZScore(s.avgEhp, globalStats.ehp.mean, globalStats.ehp.stdDev)
  )
  const ehbZScores = teamStats.map(s =>
    calculateZScore(s.avgEhb, globalStats.ehb.mean, globalStats.ehb.stdDev)
  )
  const dailyHoursZScores = teamStats.map(s =>
    calculateZScore(s.avgDailyHours, globalStats.dailyHours.mean, globalStats.dailyHours.stdDev)
  )

  // Calculate variance of z-scores across teams (lower = more balanced)
  const ehpVariance = calculateVariance(ehpZScores)
  const ehbVariance = calculateVariance(ehbZScores)
  const dailyHoursVariance = calculateVariance(dailyHoursZScores)

  // Calculate circular variance for timezone cohesion within each team
  // Then take variance of those circular variances across teams
  const timezoneCircularVariances = teamStats.map(s =>
    calculateCircularVariance(s.timezoneAngles)
  )
  const timezoneVariance = calculateVariance(timezoneCircularVariances)

  // Calculate team size variance (promotes equal-sized teams)
  const teamSizes = assignment.map(team => team.length)
  const teamSizeVariance = calculateVariance(teamSizes)

  // Weighted sum of variances (weights should sum to 1.0)
  return (
    config.varianceWeights.timezone * timezoneVariance +
    config.varianceWeights.ehp * ehpVariance +
    config.varianceWeights.ehb * ehbVariance +
    config.varianceWeights.dailyHours * dailyHoursVariance +
    config.varianceWeights.teamSize * teamSizeVariance
  )
}

/**
 * Generate a neighbor configuration by swapping or moving players
 * Uses configurable move operator probabilities
 */
function generateNeighbor(assignment: string[][], config: SimulatedAnnealingConfig): string[][] {
  const newAssignment = assignment.map(team => [...team])

  // Get move probabilities (use defaults if not provided)
  const swapProb = config.moves?.swapProbability ?? 0.7
  const random = Math.random()

  if (random < swapProb && newAssignment.length >= 2) {
    // Swap two members between teams
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
    // Move one member to another team (remaining probability)
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
 * Implements exponential cooling schedule and optional stagnation detection
 * Uses z-score normalization and circular variance for improved metric comparison
 */
function simulatedAnnealing(
  players: PlayerFeatures[],
  numberOfTeams: number,
  config: SimulatedAnnealingConfig
): TeamAssignment {
  // Set random seed if provided for reproducibility
  if (config.randomSeed !== undefined) {
    // Note: JavaScript doesn't have built-in seedable RNG
    // This is a placeholder - for production, consider using a library like seedrandom
    console.log(`Using random seed: ${config.randomSeed}`)
    // TODO: Implement seedable random with library if reproducibility is critical
  }

  // Calculate global statistics once for z-score normalization
  const globalStats = calculateGlobalStats(players)

  // Create player map for quick lookup
  const playerMap = new Map(players.map(p => [p.userId, p]))

  // Initialize with random assignment (round-robin for consistency)
  const currentAssignment: string[][] = Array.from({ length: numberOfTeams }, () => [])
  players.forEach((player, idx) => {
    currentAssignment[idx % numberOfTeams]!.push(player.userId)
  })

  let currentObjective = calculateObjective(currentAssignment, playerMap, config, globalStats)
  let bestAssignment = currentAssignment.map(team => [...team])
  let bestObjective = currentObjective

  // Stagnation detection variables
  let noImprovementCount = 0
  const stagnationLimit = config.stagnationLimit

  // Simulated annealing loop
  for (let iteration = 0; iteration < config.iterations; iteration++) {
    // Calculate temperature using exponential cooling schedule
    // Formula: T(k) = T₀ * (T_f / T₀)^(k / N)
    const temperature = SA_FORMULAS.exponentialCooling(
      config.initialTemperature,
      config.finalTemperature,
      iteration,
      config.iterations
    )

    // Early termination if temperature too low
    if (temperature < config.finalTemperature) {
      break
    }

    // Generate neighbor configuration
    const neighborAssignment = generateNeighbor(currentAssignment, config)
    const neighborObjective = calculateObjective(neighborAssignment, playerMap, config, globalStats)

    // Calculate delta
    const delta = neighborObjective - currentObjective

    // Decide whether to accept the neighbor using Metropolis criterion
    const acceptanceProbability = SA_FORMULAS.metropolisAcceptance(delta, temperature)
    const accept = Math.random() < acceptanceProbability

    if (accept) {
      // Update current assignment
      currentAssignment.splice(0, currentAssignment.length, ...neighborAssignment)
      currentObjective = neighborObjective

      // Track best solution
      if (neighborObjective < bestObjective) {
        bestAssignment = neighborAssignment.map(team => [...team])
        bestObjective = neighborObjective
        noImprovementCount = 0 // Reset stagnation counter
      } else {
        noImprovementCount++
      }
    } else {
      noImprovementCount++
    }

    // Check for stagnation (early termination)
    if (stagnationLimit !== undefined && noImprovementCount >= stagnationLimit) {
      console.log(`Terminated early at iteration ${iteration} due to stagnation`)
      break
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
    weights: BalancingWeights // Legacy: for participant scoring (deprecated, not used in SA)
    simulatedAnnealing?: {
      // Basic parameters
      iterations?: number
      initialTemperature?: number
      finalTemperature?: number

      // New: Extended parameters
      randomSeed?: number
      stagnationLimit?: number

      // New: Variance weights (replaces participant weights in SA)
      varianceWeights?: {
        timezone?: number
        ehp?: number
        ehb?: number
        dailyHours?: number
        teamSize?: number
      }

      // New: Move operator probabilities
      moves?: {
        swapProbability?: number
        moveProbability?: number
      }
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

  // Configure simulated annealing with standard defaults
  const defaults = SA_STANDARD_CONFIG
  const saConfig: SimulatedAnnealingConfig = {
    // Basic annealing parameters
    iterations: config.simulatedAnnealing?.iterations ?? defaults.annealing.iterations,
    initialTemperature: config.simulatedAnnealing?.initialTemperature ?? defaults.annealing.initialTemperature,
    finalTemperature: config.simulatedAnnealing?.finalTemperature ?? defaults.annealing.finalTemperature,

    // Variance weights (use provided or standard defaults)
    varianceWeights: {
      timezone: config.simulatedAnnealing?.varianceWeights?.timezone ?? defaults.weights.timezoneVariance,
      ehp: config.simulatedAnnealing?.varianceWeights?.ehp ?? defaults.weights.averageEHP,
      ehb: config.simulatedAnnealing?.varianceWeights?.ehb ?? defaults.weights.averageEHB,
      dailyHours: config.simulatedAnnealing?.varianceWeights?.dailyHours ?? defaults.weights.averageDailyHours,
      teamSize: config.simulatedAnnealing?.varianceWeights?.teamSize ?? defaults.weights.teamSizeVariance,
    },

    // New: Extended parameters
    randomSeed: config.simulatedAnnealing?.randomSeed,
    stagnationLimit: config.simulatedAnnealing?.stagnationLimit ?? defaults.termination.stagnationLimit,

    // New: Move operators
    moves: config.simulatedAnnealing?.moves ? {
      swapProbability: config.simulatedAnnealing.moves.swapProbability ?? defaults.moves.swapProbability,
      moveProbability: config.simulatedAnnealing.moves.moveProbability ?? defaults.moves.moveProbability,
    } : {
      swapProbability: defaults.moves.swapProbability,
      moveProbability: defaults.moves.moveProbability,
    },
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
    ehp: 0.25,
    ehb: 0.25,
    timezone: 0.25,
    dailyHours: 0.25,
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
