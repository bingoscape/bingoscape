import { MAX_GOAL_TARGET } from "@/lib/goal-validation"
import { parseTargetInput } from "@/lib/number-input"
import type { OsrsItem } from "@/types/osrs-items"
import type { SelectedItem } from "./types"
import { resolveItemId } from "./utils"

/** An item with a quantity, e.g. a reviewed line of a pasted list. */
export interface QuantifiedItem {
  item: OsrsItem
  quantity: number
}

/**
 * Adds items to the selection. An item that is already selected is not added
 * a second time: its quantities are summed, so pasting a list twice or
 * listing an item on two lines loses nothing (capped at the largest target a
 * goal can have). A selected quantity that is not a valid number is replaced
 * by the added one. New items go to the end, in order.
 */
export function mergeSelectedItems(
  selected: SelectedItem[],
  additions: QuantifiedItem[]
): SelectedItem[] {
  const result = [...selected]
  for (const { item, quantity } of additions) {
    const id = resolveItemId(item)
    const index = result.findIndex((entry) => resolveItemId(entry.item) === id)
    const existing = result[index]
    if (!existing) {
      result.push({ item, quantity: String(quantity) })
      continue
    }
    const current = parseTargetInput(existing.quantity)
    result[index] = {
      ...existing,
      quantity: String(
        current === null
          ? quantity
          : Math.min(MAX_GOAL_TARGET, current + quantity)
      ),
    }
  }
  return result
}
