/**
 * Standard Simulated Annealing Configuration
 *
 * This module defines the canonical configuration for the simulated annealing-based
 * team balancing algorithm. The configuration follows established best practices
 * for multi-objective optimization in team composition.
 *
 * @module simulated-annealing-config
 */

/**
 * Standard configuration for simulated annealing team balancing algorithm
 *
 * This configuration assumes optimization across multiple dimensions:
 * - Timezone cohesion
 * - EHP (Efficient Hours Played) balance
 * - EHB (Efficient Hours Bossed) balance
 * - Daily availability balance
 *
 * Suitable for medium-scale events (≈ 50-200 participants, 4-10 teams)
 */
export interface SAStandardConfig {
  /**
   * Annealing schedule parameters
   */
  annealing: {
    /**
     * Initial temperature (T₀)
     * Higher values allow more exploration of suboptimal solutions early in the process
     * @default 1.0
     */
    initialTemperature: number

    /**
     * Final temperature (T_f)
     * Near-zero values ensure exploitation of best solutions at the end
     * @default 0.0001
     */
    finalTemperature: number

    /**
     * Total number of iterations (N)
     * More iterations allow better convergence but increase runtime
     * @default 20000
     */
    iterations: number

    /**
     * Cooling schedule type
     * Determines how temperature decreases over iterations
     * Formula: T(k) = T₀ * (T_f / T₀)^(k / N)
     * @default "exponential"
     */
    coolingSchedule: 'exponential'

    /**
     * Random seed for reproducibility (optional)
     * Using the same seed with identical input will produce identical results
     * @default undefined (random)
     */
    randomSeed?: number
  }

  /**
   * Move operator probabilities
   * Must sum to 1.0
   */
  moves: {
    /**
     * Probability of swap operation
     * Swaps two participants from different teams
     * @default 0.7
     */
    swapProbability: number

    /**
     * Probability of move operation
     * Moves a single participant from one team to another
     * @default 0.3
     */
    moveProbability: number
  }

  /**
   * Objective function weights
   * Controls relative importance of each metric in team balance optimization
   *
   * IMPORTANT: Weights must sum to 1.0 (100%)
   * Each weight represents the proportional contribution to the objective function
   * Higher weights emphasize that metric more strongly in the optimization
   */
  weights: {
    /**
     * Weight for timezone variance minimization
     * Higher value emphasizes keeping teams timezone-cohesive
     * @default 0.333 (33.3%)
     */
    timezoneVariance: number

    /**
     * Weight for EHP (Efficient Hours Played) balance
     * @default 0.167 (16.7%)
     */
    averageEHP: number

    /**
     * Weight for EHB (Efficient Hours Bossed) balance
     * @default 0.167 (16.7%)
     */
    averageEHB: number

    /**
     * Weight for daily hours availability balance
     * @default 0.167 (16.7%)
     */
    averageDailyHours: number

    /**
     * Weight for team size variance minimization
     * Higher value emphasizes equal-sized teams
     * Set to 0 to ignore team size balance
     * @default 0.167 (16.7%)
     */
    teamSizeVariance: number
  }

  /**
   * Termination criteria
   */
  termination: {
    /**
     * Minimum temperature threshold
     * Algorithm stops if temperature falls below this value
     * @default 0.0001
     */
    minTemperature: number

    /**
     * Maximum iterations
     * Absolute stopping condition
     * @default 20000
     */
    maxIterations: number

    /**
     * Stagnation limit (optional)
     * Terminate early if no improvement for this many iterations
     * Helps avoid wasting time when convergence is reached
     * @default 5000
     */
    stagnationLimit?: number
  }
}

/**
 * Standard configuration for medium-sized events (100-200 participants)
 *
 * This is the recommended default configuration that balances:
 * - Solution quality (sufficient iterations for convergence)
 * - Runtime performance (reasonable execution time)
 * - Reproducibility (consistent results)
 */
export const SA_STANDARD_CONFIG: SAStandardConfig = {
  annealing: {
    initialTemperature: 1.0,
    finalTemperature: 0.0001,
    iterations: 20000,
    coolingSchedule: 'exponential',
    randomSeed: undefined, // Random by default
  },
  moves: {
    swapProbability: 0.7,
    moveProbability: 0.3,
  },
  weights: {
    // Normalized weights (sum to 1.0)
    // 2/6 = 0.333 for timezone (emphasized)
    // 1/6 = 0.167 for each other metric
    timezoneVariance: 0.333,  // Emphasize timezone cohesion (33.3%)
    averageEHP: 0.167,        // 16.7%
    averageEHB: 0.167,        // 16.7%
    averageDailyHours: 0.167, // 16.7%
    teamSizeVariance: 0.167,  // Promote equal-sized teams (16.7%)
  },
  termination: {
    minTemperature: 0.0001,
    maxIterations: 20000,
    stagnationLimit: 5000,
  },
}

/**
 * Event size-based configuration presets
 *
 * These presets adjust iteration counts and termination criteria
 * based on the expected number of participants and teams
 */
export const SA_PRESETS: Record<'small' | 'medium' | 'large', SAStandardConfig> = {
  /**
   * Small event preset (50-100 participants, 2-5 teams)
   *
   * Uses fewer iterations for faster results while still
   * achieving good balance for smaller problem spaces
   */
  small: {
    annealing: {
      initialTemperature: 1.0,
      finalTemperature: 0.0001,
      iterations: 10000,  // Reduced for faster execution
      coolingSchedule: 'exponential',
      randomSeed: undefined,
    },
    moves: {
      swapProbability: 0.7,
      moveProbability: 0.3,
    },
    weights: {
      timezoneVariance: 0.333,
      averageEHP: 0.167,
      averageEHB: 0.167,
      averageDailyHours: 0.167,
      teamSizeVariance: 0.167,
    },
    termination: {
      minTemperature: 0.0001,
      maxIterations: 10000,
      stagnationLimit: 2500,  // Reduced proportionally
    },
  },

  /**
   * Medium event preset (100-200 participants, 4-10 teams)
   *
   * Standard configuration - balances quality and performance
   * Suitable for most use cases
   */
  medium: {
    ...SA_STANDARD_CONFIG,
  },

  /**
   * Large event preset (200+ participants, 10+ teams)
   *
   * Uses more iterations for better convergence in larger,
   * more complex problem spaces
   */
  large: {
    annealing: {
      initialTemperature: 1.0,
      finalTemperature: 0.0001,
      iterations: 30000,  // Increased for better convergence
      coolingSchedule: 'exponential',
      randomSeed: undefined,
    },
    moves: {
      swapProbability: 0.7,
      moveProbability: 0.3,
    },
    weights: {
      timezoneVariance: 0.333,
      averageEHP: 0.167,
      averageEHB: 0.167,
      averageDailyHours: 0.167,
      teamSizeVariance: 0.167,
    },
    termination: {
      minTemperature: 0.0001,
      maxIterations: 30000,
      stagnationLimit: 7500,  // Increased proportionally
    },
  },
}

/**
 * Get a configuration preset by event size
 *
 * @param size - Event size category
 * @returns Configuration for the specified event size
 */
export function getPresetConfig(size: 'small' | 'medium' | 'large'): SAStandardConfig {
  return { ...SA_PRESETS[size] }
}

/**
 * Estimate runtime in seconds based on iteration count
 *
 * This is a rough estimate and actual runtime will vary based on:
 * - Number of participants
 * - Number of teams
 * - Hardware performance
 * - Metadata availability
 *
 * @param iterations - Number of iterations
 * @returns Estimated runtime in seconds
 */
export function estimateRuntime(iterations: number): number {
  // Rough estimate: ~0.0005 seconds per iteration for medium-sized events
  // This is a conservative estimate and may vary significantly
  const secondsPerIteration = 0.0005
  return Math.ceil(iterations * secondsPerIteration)
}

/**
 * Validate a simulated annealing configuration
 *
 * Checks that all values are within acceptable ranges and
 * constraints are satisfied
 *
 * @param config - Configuration to validate
 * @returns Validation result with errors if any
 */
export function validateConfig(config: SAStandardConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Temperature validation
  if (config.annealing.initialTemperature <= 0) {
    errors.push('Initial temperature must be positive')
  }
  if (config.annealing.finalTemperature <= 0) {
    errors.push('Final temperature must be positive')
  }
  if (config.annealing.finalTemperature >= config.annealing.initialTemperature) {
    errors.push('Final temperature must be less than initial temperature')
  }

  // Iteration validation
  if (config.annealing.iterations <= 0) {
    errors.push('Iterations must be positive')
  }
  if (config.annealing.iterations > 100000) {
    errors.push('Iterations exceeds reasonable limit (100,000)')
  }

  // Move probability validation
  if (config.moves.swapProbability < 0 || config.moves.swapProbability > 1) {
    errors.push('Swap probability must be between 0 and 1')
  }
  if (config.moves.moveProbability < 0 || config.moves.moveProbability > 1) {
    errors.push('Move probability must be between 0 and 1')
  }
  const totalProbability = config.moves.swapProbability + config.moves.moveProbability
  if (Math.abs(totalProbability - 1.0) > 0.001) {
    errors.push('Move probabilities must sum to 1.0')
  }

  // Weight validation
  if (config.weights.timezoneVariance < 0) {
    errors.push('Timezone variance weight must be non-negative')
  }
  if (config.weights.averageEHP < 0) {
    errors.push('EHP weight must be non-negative')
  }
  if (config.weights.averageEHB < 0) {
    errors.push('EHB weight must be non-negative')
  }
  if (config.weights.averageDailyHours < 0) {
    errors.push('Daily hours weight must be non-negative')
  }
  if (config.weights.teamSizeVariance < 0) {
    errors.push('Team size variance weight must be non-negative')
  }

  // Weight sum validation - must sum to 1.0 (with small tolerance for floating point)
  const weightSum =
    config.weights.timezoneVariance +
    config.weights.averageEHP +
    config.weights.averageEHB +
    config.weights.averageDailyHours +
    config.weights.teamSizeVariance
  if (Math.abs(weightSum - 1.0) > 0.001) {
    errors.push(`Weights must sum to 1.0 (currently ${weightSum.toFixed(3)})`)
  }

  // Termination validation
  if (config.termination.stagnationLimit !== undefined) {
    if (config.termination.stagnationLimit <= 0) {
      errors.push('Stagnation limit must be positive')
    }
    if (config.termination.stagnationLimit > config.annealing.iterations) {
      errors.push('Stagnation limit cannot exceed total iterations')
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Mathematical formulas used in the simulated annealing algorithm
 */
export const SA_FORMULAS = {
  /**
   * Exponential cooling schedule
   * T(k) = T₀ * (T_f / T₀)^(k / N)
   *
   * Where:
   * - T(k) = temperature at iteration k
   * - T₀ = initial temperature
   * - T_f = final temperature
   * - k = current iteration
   * - N = total iterations
   */
  exponentialCooling: (T0: number, Tf: number, k: number, N: number): number => {
    return T0 * Math.pow(Tf / T0, k / N)
  },

  /**
   * Metropolis acceptance criterion
   * P(accept) = 1 if ΔE ≤ 0
   * P(accept) = e^(-ΔE / T) if ΔE > 0
   *
   * Where:
   * - ΔE = E_new - E_current (energy difference)
   * - T = current temperature
   */
  metropolisAcceptance: (deltaE: number, temperature: number): number => {
    if (deltaE <= 0) return 1.0
    return Math.exp(-deltaE / temperature)
  },
}
