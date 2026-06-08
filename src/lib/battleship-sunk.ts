export type BattleshipShipTiles = {
  shipId: string
  teamId: string
  tileIds: string[]
}

export type BattleshipHitRecord = {
  tileId: string
  attackerTeamId: string
}

/** Tile IDs on opponent ships fully hit by the given attacking team. */
export function getSunkShipTileIds(
  ships: BattleshipShipTiles[],
  hits: BattleshipHitRecord[],
  attackerTeamId: string
): string[] {
  const hitTileIds = new Set(
    hits
      .filter((h) => h.attackerTeamId === attackerTeamId)
      .map((h) => h.tileId)
  )

  const sunkTileIds = new Set<string>()

  for (const ship of ships) {
    if (ship.teamId === attackerTeamId) continue
    if (ship.tileIds.length === 0) continue
    if (ship.tileIds.every((tileId) => hitTileIds.has(tileId))) {
      for (const tileId of ship.tileIds) {
        sunkTileIds.add(tileId)
      }
    }
  }

  return [...sunkTileIds]
}
