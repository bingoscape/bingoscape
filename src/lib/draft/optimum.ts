import { SA_STANDARD_CONFIG } from "@/lib/simulated-annealing-config"
import {
  calculateGlobalStats,
  calculateObjective,
  simulatedAnnealing,
  type SimulatedAnnealingConfig,
} from "@/lib/team-balancing/annealing"
import {
  preparePlayerFeatures,
  type PlayerFeatures,
} from "@/lib/team-balancing/scoring"

/**
 * How far a drafted result is from what the team balancing optimiser finds
 * (team draft 4/4, #218). The same objective that `generateBalancedTeams`
 * minimises (variance of the team averages of EHP, EHB, daily hours and skill
 * level plus the timezone spread, lower is better) is evaluated for the drafted
 * teams and for the best assignment simulated annealing finds over the same
 * players into the same number of teams. The optimiser ignores captains and
 * draft rules, and its team sizes may differ by a player or two, so the gap is
 * a yardstick, not a target.
 */

export interface OptimumPlayerMetadata {
  timezone: string | null
  ehp: number | null
  ehb: number | null
  dailyHoursAvailable: number | null
  skillLevel?: string | null
}

export interface OptimumComparison {
  /** Objective of the drafted teams; null when their sizes are too uneven to score. */
  actual: number | null
  /** Best objective the annealing found. */
  optimum: number
  /** `actual - optimum` (never below 0); null with `actual`. */
  gap: number | null
  players: number
  teams: number
}

/** A cheaper schedule than a generation run: this is a yardstick on a page view. */
const ITERATIONS = 6000

function annealingConfig(): SimulatedAnnealingConfig {
  const defaults = SA_STANDARD_CONFIG
  return {
    iterations: ITERATIONS,
    initialTemperature: defaults.annealing.initialTemperature,
    finalTemperature: defaults.annealing.finalTemperature,
    varianceWeights: {
      timezone: defaults.weights.timezoneVariance,
      ehp: defaults.weights.averageEHP,
      ehb: defaults.weights.averageEHB,
      dailyHours: defaults.weights.averageDailyHours,
      skillLevel: (defaults.weights as Record<string, number>).skillLevel ?? 0,
    },
    stagnationLimit: 2000,
    moves: {
      swapProbability: defaults.moves.swapProbability,
      moveProbability: defaults.moves.moveProbability,
    },
  }
}

/**
 * `teams` are the drafted rosters as user ids (captain and picks);
 * `metadata` holds what is known of those players. Null when there is nothing
 * to compare (fewer than two teams or no players).
 */
export function compareToOptimum(
  teams: readonly (readonly string[])[],
  metadata: ReadonlyMap<string, OptimumPlayerMetadata>
): OptimumComparison | null {
  const rosters = teams.map((team) => [...team])
  const userIds = rosters.flat()
  if (rosters.length < 2 || userIds.length < rosters.length) return null

  const features: PlayerFeatures[] = preparePlayerFeatures(
    userIds.map((userId) => ({ userId })),
    new Map(
      userIds.map((userId) => [
        userId,
        metadata.get(userId) ?? {
          timezone: null,
          ehp: null,
          ehb: null,
          dailyHoursAvailable: null,
        },
      ])
    )
  )
  const config = annealingConfig()
  const playerMap = new Map(features.map((f) => [f.userId, f]))
  const stats = calculateGlobalStats(features)

  const drafted = calculateObjective(rosters, playerMap, config, stats)
  const best = simulatedAnnealing(features, rosters.length, config)
  const actual = Number.isFinite(drafted) ? drafted : null
  return {
    actual,
    optimum: best.objective,
    gap: actual === null ? null : Math.max(0, actual - best.objective),
    players: userIds.length,
    teams: rosters.length,
  }
}
