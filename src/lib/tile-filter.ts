import { getTileTeamStatus, type StatusTile } from "@/lib/tile-status"

export const TILE_FILTERS = ["attention", "incomplete", "hidden"] as const
export type TileFilter = (typeof TILE_FILTERS)[number]

export function isTileFilter(
  value: string | null | undefined
): value is TileFilter {
  return !!value && (TILE_FILTERS as readonly string[]).includes(value)
}

export interface TileFilterContext {
  /** The Team whose progress is shown. */
  teamId: string | undefined
  isManagement: boolean
}

/**
 * Filters that make sense for this viewer: "hidden" is management only (a
 * player must never be able to tell hidden Tiles apart), and "incomplete"
 * needs a Team to measure against.
 */
export function availableFilters({
  teamId,
  isManagement,
}: TileFilterContext): TileFilter[] {
  return TILE_FILTERS.filter((filter) => {
    if (filter === "hidden") return isManagement
    if (filter === "incomplete") return !!teamId
    return true
  })
}

/** Narrows a requested filter (e.g. from the URL) to one this viewer may use. */
export function resolveTileFilter(
  filter: TileFilter | null,
  context: TileFilterContext
): TileFilter | null {
  return filter && availableFilters(context).includes(filter) ? filter : null
}

/**
 * - attention: players see their Team's Tiles that are pending or have
 *   changes requested; management sees Tiles with a Submission awaiting review
 *   from any Team.
 * - incomplete: the viewed Team has not completed the Tile.
 * - hidden: placeholder Tiles (management only).
 * Hidden Tiles only ever match "hidden".
 */
export function tileMatchesFilter(
  tile: StatusTile,
  filter: TileFilter,
  context: TileFilterContext
): boolean {
  if (filter === "hidden") return context.isManagement && tile.isHidden
  if (tile.isHidden) return false

  if (filter === "attention" && context.isManagement) {
    return (tile.teamTileSubmissions ?? []).some((tts) =>
      (tts.submissions ?? []).some((s) => s.status === "pending")
    )
  }

  const { completion, submissionState } = getTileTeamStatus(
    tile,
    context.teamId
  )
  if (filter === "incomplete") {
    return !!context.teamId && completion === "incomplete"
  }
  return (
    completion !== "completed" &&
    (submissionState === "pending" || submissionState === "needs_review")
  )
}

/** Ids of Tiles to dim: everything that does not match the active filter. */
export function getDimmedTileIds(
  tiles: StatusTile[],
  filter: TileFilter | null,
  context: TileFilterContext
): ReadonlySet<string> | undefined {
  if (!filter) return undefined
  const dimmed = new Set<string>()
  for (const tile of tiles) {
    if (!tileMatchesFilter(tile, filter, context)) dimmed.add(tile.id)
  }
  return dimmed
}

export function countTilesByFilter(
  tiles: StatusTile[],
  context: TileFilterContext
): Record<TileFilter, number> {
  const counts: Record<TileFilter, number> = {
    attention: 0,
    incomplete: 0,
    hidden: 0,
  }
  for (const filter of availableFilters(context)) {
    for (const tile of tiles) {
      if (tileMatchesFilter(tile, filter, context)) counts[filter]++
    }
  }
  return counts
}
