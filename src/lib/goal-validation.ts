/** Postgres `integer` upper bound; goals.target_value is an integer column. */
export const MAX_GOAL_TARGET = 2_147_483_647

/** Upper bound on goals created in one batch request. */
export const MAX_GOALS_PER_BATCH = 100

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
