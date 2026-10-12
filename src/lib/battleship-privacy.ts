/**
 * On a battleship Board a Team must never learn what the opponent hit. The
 * page data used to carry every Team's Submissions on every Tile, so the
 * opponent's completed Tiles (together with the viewer's own fleet, which the
 * viewer knows) gave the result away. For non-managers the Tiles of a
 * battleship Board therefore only keep the viewer's own Team's records.
 */

interface WithTeamRecords {
  teamTileSubmissions?: Array<{ teamId: string }>
}

export function keepOwnTeamRecords<T extends WithTeamRecords>(
  tile: T,
  ownTeamId: string | null
): T {
  if (tile.teamTileSubmissions === undefined) return tile
  return {
    ...tile,
    teamTileSubmissions: tile.teamTileSubmissions.filter(
      (tts) => ownTeamId !== null && tts.teamId === ownTeamId
    ),
  }
}
