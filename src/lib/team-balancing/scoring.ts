import * as timezoneUtils from "@/lib/timezones"

/**
 * The pure scoring helpers of team balancing, moved unchanged out of
 * `src/app/actions/team-balancing.ts` (a `"use server"` file may only export
 * async functions) so the team draft can rate players with the same formula
 * (team draft 1/4, #215). No database access, no side effects.
 */

/**
 * Weights for player scoring calculation used in team balance metrics display.
 *
 * IMPORTANT: These weights are ONLY used for calculatePlayerScore() which is
 * used by calculateTeamBalanceMetrics() for display purposes.
 *
 * The actual team balancing algorithm (simulated annealing) uses VARIANCE weights
 * configured separately in SimulatedAnnealingConfig.varianceWeights.
 *
 * Note: Timezone is NOT included here because:
 * - Timezone is not a player quality metric (no timezone is "better" than another)
 * - Timezone balance is handled by SA algorithm using circular variance
 * - This measures in-team timezone cohesion, not individual player scoring
 */
export interface BalancingWeights {
  ehp: number // 0-1
  ehb: number // 0-1
  dailyHours: number // 0-1
}

/**
 * The weights the balance metrics display uses (equal weights), and the ones
 * the team draft rates players with.
 */
export const DISPLAY_BALANCING_WEIGHTS: BalancingWeights = {
  ehp: 0.33,
  ehb: 0.33,
  dailyHours: 0.34,
}

export interface PlayerFeatures {
  userId: string
  timezoneOffset: number // UTC offset in hours (kept for reference)
  timezoneAngle: number // Timezone converted to radians for circular statistics
  ehp: number // Imputed with mean if missing
  ehb: number // Imputed with mean if missing
  dailyHours: number // Imputed with mean if missing
  skillLevel: number // Imputed with mean if missing
}

export interface PlayerScoreBreakdown {
  ehp: number
  ehb: number
  dailyHours: number
}

/**
 * Normalize a value using percentile ranking
 */
export function percentileNormalize(
  value: number | null | undefined,
  allValues: (number | null | undefined)[]
): number {
  if (value === null || value === undefined) return 0.5 // Neutral score for missing data

  const validValues = allValues.filter(
    (v): v is number => v !== null && v !== undefined
  )
  if (validValues.length === 0) return 0.5

  const sortedValues = [...validValues].sort((a, b) => a - b)
  const rank = sortedValues.filter((v) => v <= value).length
  return rank / sortedValues.length
}

/**
 * Convert timezone string to UTC offset in hours
 * Used for calculating actual timezone overlap
 */
export function getTimezoneOffset(timezone: string | null | undefined): number {
  if (!timezone) return 0 // Neutral/unknown timezone (UTC)

  // Use the DST-aware timezone utility
  // This dynamically calculates offsets based on current date, handling DST automatically
  return timezoneUtils.getTimezoneOffset(timezone)
}

/**
 * Calculate composite player score based on metadata and weights
 */
export function calculatePlayerScore(
  metadata: {
    ehp: number | null
    ehb: number | null
    timezone: string | null
    dailyHoursAvailable: number | null
  },
  allMetadata: Array<typeof metadata>,
  weights: BalancingWeights
): { score: number; breakdown: PlayerScoreBreakdown } {
  // Normalize each attribute
  const ehpScore = percentileNormalize(
    metadata.ehp,
    allMetadata.map((m) => m.ehp)
  )

  const ehbScore = percentileNormalize(
    metadata.ehb,
    allMetadata.map((m) => m.ehb)
  )

  const dailyHoursScore = percentileNormalize(
    metadata.dailyHoursAvailable,
    allMetadata.map((m) => m.dailyHoursAvailable)
  )

  // Apply weights and calculate composite score
  const breakdown = {
    ehp: ehpScore * weights.ehp,
    ehb: ehbScore * weights.ehb,
    dailyHours: dailyHoursScore * weights.dailyHours,
  }

  // Calculate total (normalize by sum of weights)
  const totalWeight = weights.ehp + weights.ehb + weights.dailyHours
  const score =
    totalWeight > 0
      ? (breakdown.ehp + breakdown.ehb + breakdown.dailyHours) / totalWeight
      : 0.5

  return { score, breakdown }
}

/**
 * Calculate mean of numeric values, filtering out nulls/undefined
 */
export function calculateMean(values: (number | null | undefined)[]): number {
  const validValues = values.filter(
    (v): v is number => v !== null && v !== undefined
  )
  if (validValues.length === 0) return 0
  return validValues.reduce((sum, v) => sum + v, 0) / validValues.length
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
export function timezoneOffsetToAngle(offset: number): number {
  return (offset / 24) * 2 * Math.PI
}

/**
 * Prepare player features for simulated annealing
 * Imputes missing values with dataset mean
 * Converts timezone offsets to angles for circular statistics
 */
export function preparePlayerFeatures(
  participants: Array<{ userId: string }>,
  metadataMap: Map<
    string,
    {
      timezone: string | null
      ehp: number | null
      ehb: number | null
      dailyHoursAvailable: number | null
      skillLevel?: string | null
    }
  >,
  skillLevelMapping: Record<string, number> = {
    beginner: 1,
    intermediate: 2,
    advanced: 3,
    expert: 4,
    pvmgod: 5,
  }
): PlayerFeatures[] {
  const allMetadata = Array.from(metadataMap.values())

  // Calculate means for imputation
  const meanEhp = calculateMean(allMetadata.map((m) => m.ehp))
  const meanEhb = calculateMean(allMetadata.map((m) => m.ehb))
  const meanDailyHours = calculateMean(
    allMetadata.map((m) => m.dailyHoursAvailable)
  )

  const skillValues = allMetadata.map((m) =>
    m.skillLevel && skillLevelMapping[m.skillLevel]
      ? skillLevelMapping[m.skillLevel]
      : null
  )
  const meanSkillLevel = calculateMean(skillValues)

  return participants.map((p) => {
    const metadata = metadataMap.get(p.userId)
    const timezoneOffset = getTimezoneOffset(metadata?.timezone)
    const mappedSkill = metadata?.skillLevel
      ? skillLevelMapping[metadata.skillLevel]
      : undefined

    return {
      userId: p.userId,
      timezoneOffset: timezoneOffset,
      timezoneAngle: timezoneOffsetToAngle(timezoneOffset),
      ehp: metadata?.ehp ?? meanEhp,
      ehb: metadata?.ehb ?? meanEhb,
      dailyHours: metadata?.dailyHoursAvailable ?? meanDailyHours,
      skillLevel: mappedSkill !== undefined ? mappedSkill : meanSkillLevel,
    }
  })
}
