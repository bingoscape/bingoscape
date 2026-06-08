import type { ShipRule } from "@/server/db/schema"
import { validateShipRulesFitBoard } from "@/lib/ship-rules"

export type ShipFleetPreset = {
  id: string
  label: string
  description: string
  rules: ShipRule[]
}

export const SHIP_FLEET_PRESETS: ShipFleetPreset[] = [
  {
    id: "standard",
    label: "Standard",
    description: "2 three-tile ships and 1 two-tile ship",
    rules: [
      { length: 3, count: 2 },
      { length: 2, count: 1 },
    ],
  },
  {
    id: "small",
    label: "Small",
    description: "1 three-tile ship and 1 two-tile ship",
    rules: [
      { length: 3, count: 1 },
      { length: 2, count: 1 },
    ],
  },
  {
    id: "classic",
    label: "Classic",
    description: "One of each: 5, 4, 3, and 2 tiles",
    rules: [
      { length: 5, count: 1 },
      { length: 4, count: 1 },
      { length: 3, count: 1 },
      { length: 2, count: 1 },
    ],
  },
]

export function presetsForBoard(
  rows: number,
  columns: number
): ShipFleetPreset[] {
  return SHIP_FLEET_PRESETS.filter(
    (preset) => validateShipRulesFitBoard(preset.rules, rows, columns) === null
  )
}

export function describeFleetRules(rules: ShipRule[]): string[] {
  return rules.map((rule) => {
    const shipWord = rule.count === 1 ? "ship" : "ships"
    const tileWord = rule.length === 1 ? "tile" : "tiles"
    return `${rule.count} ${shipWord} · ${rule.length} ${tileWord} each`
  })
}
