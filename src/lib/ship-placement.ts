export type TileCoord = {
  id: string
  col: number
  row: number
}

export type ShipPlacementInput = {
  length: number
  tileIds: string[]
}

function tileCoords(
  tileIds: string[],
  tiles: TileCoord[]
): Array<{ col: number; row: number }> {
  const byId = new Map(tiles.map((t) => [t.id, t]))
  const coords: Array<{ col: number; row: number }> = []
  for (const id of tileIds) {
    const t = byId.get(id)
    if (!t) return []
    coords.push({ col: t.col, row: t.row })
  }
  return coords
}

/** Straight line with no gaps — horizontal (same row) or vertical (same column). */
export function isStraightContiguous(
  tileIds: string[],
  tiles: TileCoord[]
): boolean {
  const coords = tileCoords(tileIds, tiles)
  if (coords.length <= 1) return true

  const cols = coords.map((c) => c.col).sort((a, b) => a - b)
  const rows = coords.map((c) => c.row).sort((a, b) => a - b)
  const minCol = cols[0]!
  const maxCol = cols[cols.length - 1]!
  const minRow = rows[0]!
  const maxRow = rows[rows.length - 1]!

  if (minCol === maxCol) {
    for (let i = 1; i < rows.length; i++) {
      if (rows[i] !== rows[i - 1]! + 1) return false
    }
    return true
  }

  if (minRow === maxRow) {
    for (let i = 1; i < cols.length; i++) {
      if (cols[i] !== cols[i - 1]! + 1) return false
    }
    return true
  }

  return false
}

function isOrthAdjacent(
  a: { col: number; row: number },
  b: { col: number; row: number }
): boolean {
  const dCol = Math.abs(a.col - b.col)
  const dRow = Math.abs(a.row - b.row)
  return (dCol === 1 && dRow === 0) || (dCol === 0 && dRow === 1)
}

function lineEndpoints(
  tileIds: string[],
  tiles: TileCoord[]
): Array<{ col: number; row: number }> {
  const coords = tileCoords(tileIds, tiles)
  if (coords.length === 0) return []
  if (coords.length === 1) return [coords[0]!]

  const cols = coords.map((c) => c.col)
  const rows = coords.map((c) => c.row)
  const minCol = Math.min(...cols)
  const maxCol = Math.max(...cols)
  const minRow = Math.min(...rows)
  const maxRow = Math.max(...rows)

  if (minCol === maxCol) {
    return [
      { col: minCol, row: minRow },
      { col: minCol, row: maxRow },
    ]
  }
  return [
    { col: minCol, row: minRow },
    { col: maxCol, row: minRow },
  ]
}

/** New tile must extend from an end of the line (not branch sideways). */
export function canAddTileToShip(
  tileId: string,
  existingIds: string[],
  tiles: TileCoord[]
): boolean {
  if (existingIds.length === 0) return true

  const candidate = [...existingIds, tileId]
  if (!isStraightContiguous(candidate, tiles)) return false

  const byId = new Map(tiles.map((t) => [t.id, t]))
  const next = byId.get(tileId)
  if (!next) return false

  const endpoints = lineEndpoints(existingIds, tiles)
  return endpoints.some((e) => isOrthAdjacent(e, next))
}

export function indexToCoord(
  index: number,
  columns: number
): { col: number; row: number } {
  return {
    col: index % columns,
    row: Math.floor(index / columns),
  }
}
