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
