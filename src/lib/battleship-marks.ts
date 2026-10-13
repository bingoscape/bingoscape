/**
 * Result of a Team's attack on a Tile, as shown on the Board. Always for the
 * signed-in viewer's own Team (see `getBattleshipBoardState`).
 */
export type BattleshipMark = "hit" | "miss" | "sunk"

/** The ids as they cross the Server -> Client Component boundary. */
export interface BattleshipMarkIds {
  hitTileIds: string[]
  missTileIds: string[]
  sunkTileIds: string[]
}

/** Precomputed once per page render so a Tile lookup is O(1). */
export interface BattleshipMarkSets {
  hit: ReadonlySet<string>
  miss: ReadonlySet<string>
  sunk: ReadonlySet<string>
}

export const EMPTY_MARK_SETS: BattleshipMarkSets = {
  hit: new Set(),
  miss: new Set(),
  sunk: new Set(),
}

export const EMPTY_MARK_IDS: BattleshipMarkIds = {
  hitTileIds: [],
  missTileIds: [],
  sunkTileIds: [],
}

export function toMarkSets(ids: BattleshipMarkIds): BattleshipMarkSets {
  return {
    hit: new Set(ids.hitTileIds),
    miss: new Set(ids.missTileIds),
    sunk: new Set(ids.sunkTileIds),
  }
}

/**
 * The marker sets to draw for the Team being viewed. The ids are the signed-in
 * viewer's own Team's results, so they only apply while that same Team is the
 * one on screen: a manager who plays in one Team and looks at the other Team's
 * progress must not see their own results on it.
 */
export function marksForViewedTeam(
  ids: BattleshipMarkIds | null | undefined,
  ownTeamId: string | null | undefined,
  viewedTeamId: string | null | undefined
): BattleshipMarkSets {
  if (!ids || !ownTeamId || ownTeamId !== viewedTeamId) return EMPTY_MARK_SETS
  return toMarkSets(ids)
}

/** A sunk ship's Tiles are hit too; the stronger state wins. */
export function markForTile(
  tileId: string,
  sets: BattleshipMarkSets | undefined
): BattleshipMark | null {
  if (!sets) return null
  if (sets.sunk.has(tileId)) return "sunk"
  if (sets.hit.has(tileId)) return "hit"
  if (sets.miss.has(tileId)) return "miss"
  return null
}

/** Legend, tile marker and accessible name share these words. */
export const MARK_LABEL: Record<BattleshipMark, string> = {
  hit: "Hit",
  miss: "Miss",
  sunk: "Sunk",
}

/** Result line in the Tile panel. */
export const MARK_RESULT: Record<BattleshipMark, string> = {
  hit: "Hit",
  miss: "Miss",
  sunk: "Ship sunk",
}

/** Newly sunk Tiles between two renders; empty when nothing new sank. */
export function newlySunkTileIds(
  previous: ReadonlySet<string>,
  next: readonly string[]
): string[] {
  return next.filter((id) => !previous.has(id))
}

/** What a RuneLite submission response reports about the shot it caused. */
export interface BattleshipShot {
  tileId: string
  result: BattleshipMark
}

/**
 * The shot a completion of `tileId` fired, from the Team's marks before and
 * after it. Null when the Tile was not newly marked (no completion happened,
 * or it was already marked). A shot that sinks a ship reports "sunk".
 */
export function battleshipShot(
  tileId: string,
  before: BattleshipMarkIds,
  after: BattleshipMarkIds
): BattleshipShot | null {
  const marked = (ids: BattleshipMarkIds) =>
    ids.hitTileIds.includes(tileId) || ids.missTileIds.includes(tileId)
  if (marked(before) || !marked(after)) return null

  if (after.sunkTileIds.includes(tileId)) return { tileId, result: "sunk" }
  if (after.hitTileIds.includes(tileId)) return { tileId, result: "hit" }
  return { tileId, result: "miss" }
}

/**
 * One ship of the viewer's OWN fleet as placed (intact: never damage or sunk
 * state). Only ever the signed-in viewer's own Team's ships.
 */
export interface BattleshipOwnShip {
  length: number
  tileIds: string[]
}

export const EMPTY_OWN_SHIPS: readonly BattleshipOwnShip[] = []

/**
 * The own ships to draw for the Team being viewed. Like `marksForViewedTeam`:
 * they are the signed-in viewer's own Team's fleet, so they only apply while
 * that same Team is on screen.
 */
export function shipsForViewedTeam(
  ships: readonly BattleshipOwnShip[] | null | undefined,
  ownTeamId: string | null | undefined,
  viewedTeamId: string | null | undefined
): readonly BattleshipOwnShip[] {
  if (!ships || !ownTeamId || ownTeamId !== viewedTeamId) {
    return EMPTY_OWN_SHIPS
  }
  return ships
}

/** How a Tile takes part in a ship: its length and which sides connect on. */
export interface ShipSegment {
  length: number
  hasLeft: boolean
  hasRight: boolean
  hasUp: boolean
  hasDown: boolean
}

/**
 * Maps every Tile carrying one of the ships to its segment. A side is
 * connected when the neighbouring grid cell in that direction (same row for
 * left/right, wrapping around the board edge never counts) holds a Tile of the
 * SAME ship. Tiles sit on the grid at `index` (row = floor(index / columns),
 * column = index % columns). Ship Tiles that are not in `tiles` are skipped.
 */
export function shipSegmentsByTile(
  ships: readonly BattleshipOwnShip[],
  columns: number,
  tiles: ReadonlyArray<{ id: string; index: number }>
): Map<string, ShipSegment> {
  const segments = new Map<string, ShipSegment>()
  if (columns <= 0) return segments

  const indexByTileId = new Map(tiles.map((tile) => [tile.id, tile.index]))

  for (const ship of ships) {
    const shipIndexes = new Set<number>()
    for (const tileId of ship.tileIds) {
      const index = indexByTileId.get(tileId)
      if (index !== undefined) shipIndexes.add(index)
    }

    for (const tileId of ship.tileIds) {
      const index = indexByTileId.get(tileId)
      if (index === undefined) continue
      const column = index % columns
      segments.set(tileId, {
        length: ship.length,
        hasLeft: column > 0 && shipIndexes.has(index - 1),
        hasRight: column < columns - 1 && shipIndexes.has(index + 1),
        hasUp: shipIndexes.has(index - columns),
        hasDown: shipIndexes.has(index + columns),
      })
    }
  }
  return segments
}
