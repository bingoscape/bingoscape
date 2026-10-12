import { parseItemName } from "osrs-item-data"
import type { NewGoalInput } from "@/app/actions/bingo"
import { getItemDisplayName } from "@/components/osrs-item-option"
import { formatNumber } from "@/lib/number-input"
import { getMetricName, getMetricTargetCopy } from "@/lib/osrs-metrics"
import type { OsrsItem } from "@/types/osrs-items"
import { resolveItemId } from "./utils"

/** The `createGoals` input for an item Goal; `targetValue` is already validated. */
export function buildItemGoalInput(
  item: OsrsItem,
  targetValue: number
): Extract<NewGoalInput, { type: "item" }> {
  const parsed = parseItemName(item.name)
  return {
    type: "item",
    itemId: resolveItemId(item),
    itemName: item.name,
    baseName: parsed.baseName,
    imageUrl: item.imageUrl,
    targetValue,
    exactVariant: parsed.variant ?? null,
  }
}

/** The `createGoals` input for a free-text Goal. */
export function buildGenericGoalInput(
  description: string,
  targetValue: number
): Extract<NewGoalInput, { type: "generic" }> {
  return { type: "generic", description: description.trim(), targetValue }
}

/** The `createGoals` input for a skill, boss or activity Goal. */
export function buildMetricGoalInput(
  metricType: string,
  metricName: string,
  targetValue: number
): Extract<NewGoalInput, { type: "metric" }> {
  return { type: "metric", metricType, metricName, targetValue }
}

/** What a new Goal reads as in confirmations: "Abyssal whip x1", "Zulrah: 50 kills". */
export function formatAddedGoal(input: NewGoalInput): string {
  const target = formatNumber(input.targetValue)
  switch (input.type) {
    case "item":
      return `${getItemDisplayName({ name: input.itemName })} x${target}`
    case "generic":
      return `${input.description.trim()} x${target}`
    case "metric": {
      const copy = getMetricTargetCopy(input.metricType)
      const unit = input.targetValue === 1 ? copy.unitSingular : copy.unit
      return `${getMetricName(input.metricName)}: ${target}${unit ? ` ${unit}` : ""}`
    }
  }
}
