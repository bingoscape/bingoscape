import type { CreateGoalsOptions } from "@/app/actions/bingo"
import { formatNewGroupRule, type NewGoalsRule } from "@/lib/goal-summary"
import { parseTargetInput } from "@/lib/number-input"

/** How several items added at once count towards the tile. */
export type CombineMode = "separate" | "all" | "any" | "atLeast"

export interface CombineState {
  mode: CombineMode
  /** What was typed for "At least N of these". */
  atLeast: string
}

/** Separate goals is the common case, so it needs no extra click. */
export const INITIAL_COMBINE: CombineState = { mode: "separate", atLeast: "2" }

/** Fewer items than this have nothing to combine, so the choice is hidden. */
export const MIN_ITEMS_TO_COMBINE = 2

export interface CombinePlan {
  /** What the items count as; "separate" when there is nothing to combine. */
  rule: NewGoalsRule
  /** The `group` option for `createGoals`; undefined adds separate goals. */
  group: CreateGoalsOptions["group"]
  /** Why the choice cannot be used yet, or null. */
  error: string | null
}

/** The whole number typed for "At least N", when it is within 1 to `count`. */
function readAtLeast(raw: string, count: number): number | null {
  const value = parseTargetInput(raw)
  return value !== null && value <= count ? value : null
}

export function atLeastError(count: number): string {
  return `Enter a number from 1 to ${count}`
}

/** Turns the choice and the number of selected items into what to send to the server. */
export function planCombine(state: CombineState, count: number): CombinePlan {
  if (count < MIN_ITEMS_TO_COMBINE || state.mode === "separate") {
    return { rule: { kind: "separate" }, group: undefined, error: null }
  }
  switch (state.mode) {
    case "all":
      return {
        rule: { kind: "all" },
        group: { operator: "AND" },
        error: null,
      }
    case "any":
      return {
        rule: { kind: "any", min: 1 },
        group: { operator: "OR", minRequiredGoals: 1 },
        error: null,
      }
    case "atLeast": {
      const min = readAtLeast(state.atLeast, count)
      if (min === null) {
        return {
          // Placeholder; the error blocks the add before this is used.
          rule: { kind: "any", min: 1 },
          group: undefined,
          error: atLeastError(count),
        }
      }
      return {
        rule: { kind: "any", min },
        group: { operator: "OR", minRequiredGoals: min },
        error: null,
      }
    }
  }
}

/** Label of the Add button: "Add 3 goals", "Add group: any 2 of 3". */
export function combineAddLabel(plan: CombinePlan, count: number): string {
  if (plan.error) return "Add group"
  if (plan.rule.kind === "separate") {
    return count === 0
      ? "Add goals"
      : `Add ${count} ${count === 1 ? "goal" : "goals"}`
  }
  return `Add group: ${formatNewGroupRule(plan.rule, count)}`
}

/**
 * Keeps the typed "At least N" within the selection when items are removed:
 * a number above the new count drops to the count. Anything else, including
 * text that is not a number yet, is left for the user to fix. Below two items
 * the choice is hidden, so the number is left alone (it would only drift to 1
 * while the first item is picked).
 */
export function clampAtLeast(raw: string, count: number): string {
  if (count < MIN_ITEMS_TO_COMBINE) return raw
  const value = parseTargetInput(raw)
  if (value === null || value <= count) return raw
  return String(Math.max(1, count))
}
