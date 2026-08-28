import type { ShipRule } from "@/server/db/schema"

/** Sum required ship counts per length (matches validateShipPlacements). */
export function aggregateShipRuleCounts(
  rules: ShipRule[]
): Record<number, number> {
  const required: Record<number, number> = {}
  for (const r of rules) {
    required[r.length] = (required[r.length] ?? 0) + r.count
  }
  return required
}

/** Collapse duplicate-length rules into one entry per length. */
export function mergeShipRulesByLength(rules: ShipRule[]): ShipRule[] {
  const required = aggregateShipRuleCounts(rules)
  return Object.entries(required)
    .map(([length, count]) => ({
      length: Number(length),
      count,
    }))
    .sort((a, b) => a.length - b.length)
}

/** Returns an error message when rules cannot fit on the board, or null if valid. */
export function validateShipRulesFitBoard(
  rules: ShipRule[],
  rows: number,
  columns: number
): string | null {
  const merged = mergeShipRulesByLength(rules)
  if (merged.length === 0) {
    return "At least one ship rule is required"
  }

  const boardCells = rows * columns
  const maxSpan = Math.max(rows, columns)
  let totalTiles = 0

  for (const rule of merged) {
    if (rule.length > maxSpan) {
      return `Ship length ${rule.length} exceeds board dimensions (${rows}×${columns})`
    }
    totalTiles += rule.length * rule.count
  }

  if (totalTiles > boardCells) {
    return `Ship rules require ${totalTiles} tiles but the board only has ${boardCells}`
  }

  return null
}

export function totalShipTiles(rules: ShipRule[]): number {
  return rules.reduce((sum, rule) => sum + rule.length * rule.count, 0)
}
