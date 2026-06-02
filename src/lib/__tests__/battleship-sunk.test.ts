import { getSunkShipTileIds } from "../battleship-sunk"

describe("getSunkShipTileIds", () => {
  const ships = [
    { shipId: "s1", teamId: "defender", tileIds: ["a", "b", "c"] },
    { shipId: "s2", teamId: "defender", tileIds: ["d", "e"] },
    { shipId: "s3", teamId: "attacker", tileIds: ["x"] },
  ]

  it("returns empty when no hits", () => {
    expect(getSunkShipTileIds(ships, [], "attacker")).toEqual([])
  })

  it("returns empty when ship is only partially hit", () => {
    const hits = [{ tileId: "a", attackerTeamId: "attacker" }]
    expect(getSunkShipTileIds(ships, hits, "attacker")).toEqual([])
  })

  it("returns all tiles on a fully sunk ship", () => {
    const hits = [
      { tileId: "d", attackerTeamId: "attacker" },
      { tileId: "e", attackerTeamId: "attacker" },
    ]
    expect(getSunkShipTileIds(ships, hits, "attacker").sort()).toEqual([
      "d",
      "e",
    ])
  })

  it("ignores hits from other attacking teams", () => {
    const hits = [
      { tileId: "d", attackerTeamId: "other" },
      { tileId: "e", attackerTeamId: "attacker" },
    ]
    expect(getSunkShipTileIds(ships, hits, "attacker")).toEqual([])
  })

  it("does not treat own ships as sunk", () => {
    const hits = [{ tileId: "x", attackerTeamId: "attacker" }]
    expect(getSunkShipTileIds(ships, hits, "attacker")).toEqual([])
  })
})
