/** Postgres `integer` upper bound; goals.target_value is an integer column. */
export const MAX_GOAL_TARGET = 2_147_483_647

/** Upper bound on goals created in one batch request. */
export const MAX_GOALS_PER_BATCH = 100

/** Upper bound on tiles that one board-level batch may change. */
export const MAX_BATCH_TILES = 100

/** Upper bound on goals and groups one board-level batch may create in total. */
export const MAX_BATCH_TOTAL_ROWS = 500

/**
 * Returns an error message, or null when a batch of `tileCount` tiles with
 * `rowsPerTile` new goals (and groups) each is within the limits.
 */
export function validateBatchSize(
  tileCount: number,
  rowsPerTile: number
): string | null {
  if (tileCount < 1) return "Select at least one tile"
  if (tileCount > MAX_BATCH_TILES) {
    return `You can change at most ${MAX_BATCH_TILES} tiles at once`
  }
  if (tileCount * rowsPerTile > MAX_BATCH_TOTAL_ROWS) {
    return `That would create ${(tileCount * rowsPerTile).toLocaleString("en-US")} goals in one go, but the limit is ${MAX_BATCH_TOTAL_ROWS}. Select fewer tiles or fewer goals.`
  }
  return null
}

/** Returns an error message, or null when the target value is acceptable. */
export function validateTargetValue(value: unknown): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return "Target value must be a whole number"
  }
  if (value <= 0) {
    return "Target value must be greater than 0"
  }
  if (value > MAX_GOAL_TARGET) {
    return `Target value cannot exceed ${MAX_GOAL_TARGET.toLocaleString("en-US")}`
  }
  return null
}

/** Returns an error message, or null when the description is acceptable. */
export function validateDescription(value: unknown): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    return "Description cannot be empty"
  }
  return null
}
