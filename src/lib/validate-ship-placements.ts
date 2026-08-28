import {
  isStraightContiguous,
  type ShipPlacementInput,
  type TileCoord,
} from "@/lib/ship-placement"
import { aggregateShipRuleCounts } from "@/lib/ship-rules"
import type { ShipRule } from "@/server/db/schema"

export function validateShipPlacements(
  rules: ShipRule[],
  placements: ShipPlacementInput[],
  tileCoords: TileCoord[],
  options?: { hiddenTileIds?: Set<string> }
): string | null {
  if (placements.length === 0) {
    return "No ships placed"
  }

  const required = aggregateShipRuleCounts(rules)

  const got: Record<number, number> = {}
  const usedTiles = new Set<string>()
  const tileSet = new Map(tileCoords.map((t) => [t.id, t]))

  for (const p of placements) {
    if (p.tileIds.length !== p.length) {
      return `Ship length ${p.length} does not match tile count ${p.tileIds.length}`
    }
    got[p.length] = (got[p.length] ?? 0) + 1

    for (const tid of p.tileIds) {
      if (usedTiles.has(tid)) {
        return "Overlapping ship tiles"
      }
      if (!tileSet.has(tid)) {
        return `Invalid tile ${tid}`
      }
      if (options?.hiddenTileIds?.has(tid)) {
        return "Cannot place ships on hidden tiles"
      }
      usedTiles.add(tid)
    }

    if (!isStraightContiguous(p.tileIds, tileCoords)) {
      return "Ships must be straight contiguous lines"
    }
  }

  for (const [length, count] of Object.entries(required)) {
    const len = Number(length)
    if ((got[len] ?? 0) !== count) {
      return `Expected ${count} ships of length ${len}, got ${got[len] ?? 0}`
    }
  }

  for (const length of Object.keys(got)) {
    const len = Number(length)
    if (required[len] === undefined) {
      return `Unexpected ship length ${len}`
    }
  }

  return null
}
