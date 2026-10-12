/**
 * Board health: a soft hint about Tiles that have no Goals yet.
 *
 * A Tile without Goals is not an error (Tiles can be completed by hand), so
 * this only ever informs; it never blocks anything. Hidden Tiles are left out:
 * they are placeholders (or secrets not revealed yet), and flagging every empty
 * cell of a Board would be noise.
 */

interface HealthTile {
  id: string
  /** Position on the Board; Tiles are walked in this order. */
  index: number
  isHidden: boolean
  /** Undefined means the Goals were not loaded, which is not the same as "none". */
  goals?: readonly unknown[] | null
}

/** True for a visible Tile whose Goals are loaded and empty. */
export function lacksGoals(tile: HealthTile): boolean {
  return !tile.isHidden && Array.isArray(tile.goals) && tile.goals.length === 0
}

/** The Tiles in Board order, without changing the input. */
function inBoardOrder<T extends HealthTile>(tiles: readonly T[]): T[] {
  return [...tiles].sort((a, b) => a.index - b.index)
}

/** The visible Tiles without Goals, in Board order. */
export function getTilesWithoutGoals<T extends HealthTile>(
  tiles: readonly T[]
): T[] {
  return inBoardOrder(tiles).filter(lacksGoals)
}

/** "1 tile has no goals" / "3 tiles have no goals". */
export function formatTilesWithoutGoals(count: number): string {
  return count === 1 ? "1 tile has no goals" : `${count} tiles have no goals`
}

export interface NextTileWithoutGoals<T extends HealthTile> {
  tile: T
  /** 1-based place of `tile` among the Tiles without Goals. */
  position: number
  /** How many Tiles have no Goals. */
  total: number
  /** The search ran past the last Tile and started again from the first. */
  wrapped: boolean
}

/**
 * The next Tile without Goals after the current one, wrapping around at the
 * end of the Board. The current Tile never counts as "next" unless it is the
 * only one left. Without a current Tile (or one that is not on this Board) the
 * first Tile without Goals is returned. Null when every Tile has Goals.
 */
export function findNextTileWithoutGoals<T extends HealthTile>(
  tiles: readonly T[],
  currentTileId: string | null
): NextTileWithoutGoals<T> | null {
  const ordered = inBoardOrder(tiles)
  const missing = ordered.filter(lacksGoals)
  const first = missing[0]
  if (!first) return null

  const currentAt = currentTileId
    ? ordered.findIndex((tile) => tile.id === currentTileId)
    : -1
  const total = missing.length

  if (currentAt < 0) return { tile: first, position: 1, total, wrapped: false }

  for (let step = 1; step <= ordered.length; step++) {
    const at = (currentAt + step) % ordered.length
    const candidate = ordered[at]
    if (candidate && lacksGoals(candidate)) {
      return {
        tile: candidate,
        position: missing.indexOf(candidate) + 1,
        total,
        wrapped: currentAt + step >= ordered.length,
      }
    }
  }
  return null
}
