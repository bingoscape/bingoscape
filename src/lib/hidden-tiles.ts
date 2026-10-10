/**
 * Hidden Tiles keep their cell on the Board (so the grid geometry never
 * shifts) but must not leak their content to anyone who cannot manage the
 * Event. These helpers redact on the server, before data reaches the client.
 */

interface RedactableTile {
  isHidden: boolean
  title: string
  description: string
  headerImage: string | null
  goals?: unknown[]
  goalGroups?: unknown[]
  teamTileSubmissions?: Array<{ submissions?: unknown[] }>
}

/**
 * Returns the Tile unchanged when it is visible. For a hidden Tile, blanks the
 * title, description, image and Goals and drops all Submissions (images and
 * users). Identity fields (id, index, tier, weight, isHidden) are kept so the
 * grid, tier ladder and XP maths keep working.
 */
export function redactHiddenTile<T extends RedactableTile>(tile: T): T {
  if (!tile.isHidden) return tile

  return {
    ...tile,
    title: "",
    description: "",
    headerImage: null,
    ...(tile.goals !== undefined ? { goals: [] } : {}),
    ...(tile.goalGroups !== undefined ? { goalGroups: [] } : {}),
    ...(tile.teamTileSubmissions !== undefined
      ? {
          teamTileSubmissions: tile.teamTileSubmissions.map((tts) => ({
            ...tts,
            submissions: [],
          })),
        }
      : {}),
  }
}

/** Redacts every hidden Tile in the list. */
export function redactHiddenTiles<T extends RedactableTile>(tiles: T[]): T[] {
  return tiles.map(redactHiddenTile)
}
