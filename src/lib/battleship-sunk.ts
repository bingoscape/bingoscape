export type BattleshipShipTiles = {
  shipId: string
  teamId: string
  tileIds: string[]
}

export type BattleshipHitRecord = {
  tileId: string
  attackerTeamId: string
}

/** Opponent ships fully hit by the given attacking team. */
export function getSunkShips(
  ships: BattleshipShipTiles[],
  hits: BattleshipHitRecord[],
  attackerTeamId: string
): BattleshipShipTiles[] {
  const hitTileIds = new Set(
    hits
      .filter((h) => h.attackerTeamId === attackerTeamId)
      .map((h) => h.tileId)
  )

  return ships.filter(
    (ship) =>
      ship.teamId !== attackerTeamId &&
      ship.tileIds.length > 0 &&
      ship.tileIds.every((tileId) => hitTileIds.has(tileId))
  )
}

/** Tile IDs on opponent ships fully hit by the given attacking team. */
export function getSunkShipTileIds(
  ships: BattleshipShipTiles[],
  hits: BattleshipHitRecord[],
  attackerTeamId: string
): Set<string> {
  return new Set(
    getSunkShips(ships, hits, attackerTeamId).flatMap((ship) => ship.tileIds)
  )
}
