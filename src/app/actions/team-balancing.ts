"use server"

import { authorize, denial, hasPermission } from "@/server/authz"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import {
  assertTeamLimitForBattleship,
  battleshipErrorMessage,
} from "@/server/battleship"
import { teams, eventParticipants, teamMembers } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import {
  DISPLAY_BALANCING_WEIGHTS,
  calculateMean,
  calculatePlayerScore,
  preparePlayerFeatures,
  type PlayerFeatures,
} from "@/lib/team-balancing/scoring"
import {
  getEventParticipantMetadata,
  calculateMetadataCoverage,
} from "./player-metadata"
import {
  SA_STANDARD_CONFIG,
  SA_FORMULAS,
} from "@/lib/simulated-annealing-config"

/**
 * Extended simulated annealing configuration
 * Supports both standard configuration and legacy options
 */
interface SimulatedAnnealingConfig {
  iterations: number // Number of optimization iterations
  initialTemperature: number // Starting temperature
  finalTemperature: number // Ending temperature

  // Variance weights for objective function
  // Note: Team size is enforced as a hard constraint, not a configurable weight
  varianceWeights: {
    timezone: number // Weight for timezone variance
    ehp: number // Weight for EHP variance
    ehb: number // Weight for EHB variance
    dailyHours: number // Weight for daily hours variance
    skillLevel?: number // Weight for skill level variance
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

interface TeamAssignment {
  teams: string[][] // Array of teams, each team is array of userIds
  objective: number // Objective function value (lower is better)
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  return (
    values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length
  )
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
  skillLevel: { mean: number; stdDev: number }
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
  const ehpValues = players.map((p) => p.ehp)
  const ehbValues = players.map((p) => p.ehb)
  const dailyHoursValues = players.map((p) => p.dailyHours)
  const skillLevelValues = players.map((p) => p.skillLevel)

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
    skillLevel: {
      mean: calculateMean(skillLevelValues),
      stdDev: calculateStandardDeviation(skillLevelValues),
    },
  }
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
  const teamStats = assignment.map((team) => {
    const players = team
      .map((userId) => playerMap.get(userId)!)
      .filter((p) => p !== undefined)
    if (players.length === 0) {
      return {
        avgEhp: 0,
        avgEhb: 0,
        avgDailyHours: 0,
        avgSkillLevel: 0,
        timezoneAngles: [] as number[],
      }
    }

    return {
      avgEhp: players.reduce((sum, p) => sum + p.ehp, 0) / players.length,
      avgEhb: players.reduce((sum, p) => sum + p.ehb, 0) / players.length,
      avgDailyHours:
        players.reduce((sum, p) => sum + p.dailyHours, 0) / players.length,
      avgSkillLevel:
        players.reduce((sum, p) => sum + p.skillLevel, 0) / players.length,
      timezoneAngles: players.map((p) => p.timezoneAngle),
    }
  })

  // Convert team averages to z-scores
  const ehpZScores = teamStats.map((s) =>
    calculateZScore(s.avgEhp, globalStats.ehp.mean, globalStats.ehp.stdDev)
  )
  const ehbZScores = teamStats.map((s) =>
    calculateZScore(s.avgEhb, globalStats.ehb.mean, globalStats.ehb.stdDev)
  )
  const dailyHoursZScores = teamStats.map((s) =>
    calculateZScore(
      s.avgDailyHours,
      globalStats.dailyHours.mean,
      globalStats.dailyHours.stdDev
    )
  )
  const skillLevelZScores = teamStats.map((s) =>
    calculateZScore(
      s.avgSkillLevel,
      globalStats.skillLevel.mean,
      globalStats.skillLevel.stdDev
    )
  )

  // Calculate variance of z-scores across teams (lower = more balanced)
  const ehpVariance = calculateVariance(ehpZScores)
  const ehbVariance = calculateVariance(ehbZScores)
  const dailyHoursVariance = calculateVariance(dailyHoursZScores)
  const skillLevelVariance = calculateVariance(skillLevelZScores)

  // Calculate timezone balance using CIRCULAR VARIANCE (not player scoring)
  // This is the CORRECT approach for timezone balancing:
  // 1. Circular variance measures in-team timezone cohesion (0=cohesive, 1=dispersed)
  //    - Low variance = teammates in similar timezones = easier coordination
  //    - High variance = teammates across many timezones = harder coordination
  // 2. Variance of circular variances balances coordination difficulty across teams
  // 3. Result: All teams have similar timezone diversity (fair distribution)
  //
  // Example:
  //   Team A (Europe): UTC+0, UTC+1, UTC+2 → CircVar ≈ 0.05 (cohesive)
  //   Team B (Global): UTC-8, UTC+0, UTC+9 → CircVar ≈ 0.85 (dispersed)
  //   Algorithm minimizes variance between 0.05 and 0.85 for fairness
  const timezoneCircularVariances = teamStats.map((s) =>
    calculateCircularVariance(s.timezoneAngles)
  )
  const timezoneVariance = calculateVariance(timezoneCircularVariances)
  const timezoneMean = calculateMean(timezoneCircularVariances)
  const timezoneObjective = timezoneMean + timezoneVariance

  // Calculate team size variance (promotes equal-sized teams)
  const teamSizes = assignment.map((team) => team.length)
  const teamSizeVariance = calculateVariance(teamSizes)

  // Pre-constraint validation: Reject solutions with excessive team size imbalance
  const totalPlayers = assignment.reduce((sum, team) => sum + team.length, 0)
  const targetSize = totalPlayers / assignment.length
  const maxAllowedVariance = targetSize * targetSize * 0.25 // Allow ±1-2 members variation

  if (teamSizeVariance > maxAllowedVariance) {
    return Infinity // Reject this solution immediately
  }

  // Weighted sum of variances (weights should sum to 1.0, excluding teamSize)
  const baseObjective =
    config.varianceWeights.timezone * timezoneObjective +
    config.varianceWeights.ehp * ehpVariance +
    config.varianceWeights.ehb * ehbVariance +
    config.varianceWeights.dailyHours * dailyHoursVariance +
    (config.varianceWeights.skillLevel ?? 0) * skillLevelVariance

  // Add small fixed penalty for team size variance as tiebreaker (not user-configurable)
  const teamSizePenalty = teamSizeVariance * 0.1

  return baseObjective + teamSizePenalty
}

/**
 * Generate a neighbor configuration by swapping or moving players
 * Uses configurable move operator probabilities
 */
function generateNeighbor(
  assignment: string[][],
  config: SimulatedAnnealingConfig
): string[][] {
  const newAssignment = assignment.map((team) => [...team])

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

    // Hard constraint: Never empty a team (keep at least 1 member)
    if (fromTeam.length > 1) {
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
  const playerMap = new Map(players.map((p) => [p.userId, p]))

  // Initialize with random assignment (round-robin for consistency)
  const currentAssignment: string[][] = Array.from(
    { length: numberOfTeams },
    () => []
  )
  players.forEach((player, idx) => {
    currentAssignment[idx % numberOfTeams]!.push(player.userId)
  })

  let currentObjective = calculateObjective(
    currentAssignment,
    playerMap,
    config,
    globalStats
  )
  let bestAssignment = currentAssignment.map((team) => [...team])
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
    const neighborObjective = calculateObjective(
      neighborAssignment,
      playerMap,
      config,
      globalStats
    )

    // Calculate delta
    const delta = neighborObjective - currentObjective

    // Decide whether to accept the neighbor using Metropolis criterion
    const acceptanceProbability = SA_FORMULAS.metropolisAcceptance(
      delta,
      temperature
    )
    const accept = Math.random() < acceptanceProbability

    if (accept) {
      // Update current assignment
      currentAssignment.splice(
        0,
        currentAssignment.length,
        ...neighborAssignment
      )
      currentObjective = neighborObjective

      // Track best solution
      if (neighborObjective < bestObjective) {
        bestAssignment = neighborAssignment.map((team) => [...team])
        bestObjective = neighborObjective
        noImprovementCount = 0 // Reset stagnation counter
      } else {
        noImprovementCount++
      }
    } else {
      noImprovementCount++
    }

    // Check for stagnation (early termination)
    if (
      stagnationLimit !== undefined &&
      noImprovementCount >= stagnationLimit
    ) {
      console.log(
        `Terminated early at iteration ${iteration} due to stagnation`
      )
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
export async function canUseBalancedGeneration(
  eventId: string
): Promise<boolean> {
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
    simulatedAnnealing?: {
      // Basic parameters
      iterations?: number
      initialTemperature?: number
      finalTemperature?: number

      // New: Extended parameters
      randomSeed?: number
      stagnationLimit?: number

      // New: Variance weights (replaces participant weights in SA)
      // Note: Team size is enforced as a hard constraint, not a weight
      skillLevelMapping?: Record<string, number>
      varianceWeights?: {
        timezone?: number
        ehp?: number
        ehb?: number
        dailyHours?: number
        skillLevel?: number
      }

      // New: Move operator probabilities
      moves?: {
        swapProbability?: number
        moveProbability?: number
      }
    }
  }
) {
  const allowed = await authorize(eventId, "team:manage")
  if (!allowed.success) return denial(allowed)

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
          user: { columns: { id: true, name: true, runescapeName: true } },
        },
      },
    },
  })

  // Filter out already assigned participants
  const assignedUserIds = new Set(
    existingTeams.flatMap((team) =>
      team.teamMembers.map((member) => member.user.id)
    )
  )

  const unassignedParticipants = allParticipants.filter(
    (p) => !assignedUserIds.has(p.user.id)
  )

  if (unassignedParticipants.length === 0) {
    return {
      success: false,
      error: "No unassigned participants to assign to teams",
    }
  }

  // Get metadata for all participants
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(metadata.map((m) => [m.userId, m]))

  // Calculate number of teams
  const numberOfTeams =
    config.generationMethod === "teamSize" && config.teamSize
      ? Math.ceil(unassignedParticipants.length / config.teamSize)
      : (config.teamCount ?? 2)

  // Prepare player features for simulated annealing
  const playerFeatures = preparePlayerFeatures(
    unassignedParticipants.map((p) => ({ userId: p.user.id })),
    metadataMap as unknown as Parameters<typeof preparePlayerFeatures>[1],
    config.simulatedAnnealing?.skillLevelMapping
  )

  // Configure simulated annealing with standard defaults
  const defaults = SA_STANDARD_CONFIG
  const saConfig: SimulatedAnnealingConfig = {
    // Basic annealing parameters
    iterations:
      config.simulatedAnnealing?.iterations ?? defaults.annealing.iterations,
    initialTemperature:
      config.simulatedAnnealing?.initialTemperature ??
      defaults.annealing.initialTemperature,
    finalTemperature:
      config.simulatedAnnealing?.finalTemperature ??
      defaults.annealing.finalTemperature,

    // Variance weights (use provided or standard defaults)
    // Note: teamSize is now enforced as a hard constraint, not a weight
    varianceWeights: {
      timezone:
        config.simulatedAnnealing?.varianceWeights?.timezone ??
        defaults.weights.timezoneVariance,
      ehp:
        config.simulatedAnnealing?.varianceWeights?.ehp ??
        defaults.weights.averageEHP,
      ehb:
        config.simulatedAnnealing?.varianceWeights?.ehb ??
        defaults.weights.averageEHB,
      dailyHours:
        config.simulatedAnnealing?.varianceWeights?.dailyHours ??
        defaults.weights.averageDailyHours,
      skillLevel:
        config.simulatedAnnealing?.varianceWeights?.skillLevel ??
        (defaults.weights as Record<string, number>).skillLevel ??
        0,
    },

    // New: Extended parameters
    randomSeed: config.simulatedAnnealing?.randomSeed,
    stagnationLimit:
      config.simulatedAnnealing?.stagnationLimit ??
      defaults.termination.stagnationLimit,

    // New: Move operators
    moves: config.simulatedAnnealing?.moves
      ? {
          swapProbability:
            config.simulatedAnnealing.moves.swapProbability ??
            defaults.moves.swapProbability,
          moveProbability:
            config.simulatedAnnealing.moves.moveProbability ??
            defaults.moves.moveProbability,
        }
      : {
          swapProbability: defaults.moves.swapProbability,
          moveProbability: defaults.moves.moveProbability,
        },
  }

  // Run simulated annealing optimization
  const optimizedAssignment = simulatedAnnealing(
    playerFeatures,
    numberOfTeams,
    saConfig
  )

  // Execute bulk inserts inside a transaction
  try {
    await db.transaction(async (tx) => {
      // Battleship events are played by exactly two teams.
      await assertTeamLimitForBattleship(tx, eventId, numberOfTeams)

      // 1. Prepare and insert teams
      const teamInsertData = Array.from({ length: numberOfTeams }).map(
        (_, i) => ({
          eventId,
          name: `${config.teamNamePrefix} ${existingTeams.length + i + 1}`,
        })
      )

      const createdTeams = await tx
        .insert(teams)
        .values(teamInsertData)
        .returning({ id: teams.id })

      // 2. Prepare team members
      const teamMemberInsertData: {
        teamId: string
        userId: string
        eventId: string
        isLeader: boolean
      }[] = []
      for (
        let teamIdx = 0;
        teamIdx < optimizedAssignment.teams.length;
        teamIdx++
      ) {
        const teamUsers = optimizedAssignment.teams[teamIdx]!
        const teamId = createdTeams[teamIdx]!.id

        for (const userId of teamUsers) {
          teamMemberInsertData.push({
            teamId,
            eventId,
            userId,
            isLeader: false,
          })
        }
      }

      // 3. Insert all team members
      if (teamMemberInsertData.length > 0) {
        await tx.insert(teamMembers).values(teamMemberInsertData)
      }
    })

    revalidatePath(`/events/${eventId}`)

    logger.info(
      {
        eventId,
        action: "generateBalancedTeams",
        teamsCreated: numberOfTeams,
        participantsAssigned: unassignedParticipants.length,
        objectiveScore: optimizedAssignment.objective,
        saConfig: {
          iterations: saConfig.iterations,
          varianceWeights: saConfig.varianceWeights,
        },
      },
      "Balanced teams generated successfully"
    )

    return {
      success: true,
      data: {
        teamsCreated: numberOfTeams,
        participantsAssigned: unassignedParticipants.length,
        objectiveScore: optimizedAssignment.objective,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error in generateBalancedTeams")
    return {
      success: false,
      error: battleshipErrorMessage(error, "Failed to generate balanced teams"),
    }
  }
}

/**
 * Calculate balance metrics for existing teams
 */
export async function calculateTeamBalanceMetrics(eventId: string) {
  // Deliberate: a denial reads as null (see guards.ts).
  if (!(await hasPermission(eventId, "stats:read"))) return null

  const existingTeams = await db.query.teams.findMany({
    where: eq(teams.eventId, eventId),
    with: {
      teamMembers: {
        with: {
          user: { columns: { id: true, name: true, runescapeName: true } },
        },
      },
    },
  })

  if (existingTeams.length === 0) {
    return null
  }

  // Get metadata
  const metadata = await getEventParticipantMetadata(eventId)
  const metadataMap = new Map(metadata.map((m) => [m.userId, m]))

  // Calculate average score per team (using equal weights for display)
  const defaultWeights = DISPLAY_BALANCING_WEIGHTS

  const allMetadata = existingTeams
    .flatMap((t) => t.teamMembers.map((m) => metadataMap.get(m.user.id)))
    .filter((m): m is NonNullable<typeof m> => m !== undefined)

  const teamScores = existingTeams.map((team) => {
    const memberScores = team.teamMembers.map((member) => {
      const userMetadata = metadataMap.get(member.user.id)
      const { score } = userMetadata
        ? calculatePlayerScore(userMetadata, allMetadata, defaultWeights)
        : { score: 0.5 }
      return score
    })

    const averageScore =
      memberScores.length > 0
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
  const overallAverage =
    teamScores.reduce((sum, t) => sum + t.averageScore, 0) / teamScores.length
  const variance =
    teamScores.reduce(
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
