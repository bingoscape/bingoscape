import { battleshipShot, EMPTY_MARK_IDS } from "../battleship-marks"
import { getSunkShips } from "../battleship-sunk"

describe("battleshipShot", () => {
  const marks = (hit: string[], miss: string[], sunk: string[]) => ({
    hitTileIds: hit,
    missTileIds: miss,
    sunkTileIds: sunk,
  })

  it("reports a hit, a miss and a sunk ship", () => {
    expect(battleshipShot("a", EMPTY_MARK_IDS, marks(["a"], [], []))).toEqual({
      tileId: "a",
      result: "hit",
    })
    expect(battleshipShot("a", EMPTY_MARK_IDS, marks([], ["a"], []))).toEqual({
      tileId: "a",
      result: "miss",
    })
    expect(
      battleshipShot(
        "b",
        marks(["a"], [], []),
        marks(["a", "b"], [], ["a", "b"])
      )
    ).toEqual({ tileId: "b", result: "sunk" })
  })

  it("is null when nothing was added for the tile", () => {
    expect(battleshipShot("a", EMPTY_MARK_IDS, EMPTY_MARK_IDS)).toBeNull()
    expect(
      battleshipShot("a", marks(["a"], [], []), marks(["a"], [], []))
    ).toBeNull()
    expect(battleshipShot("a", EMPTY_MARK_IDS, marks(["b"], [], []))).toBeNull()
  })
})

describe("getSunkShips", () => {
  const ships = [
    { shipId: "s1", teamId: "b", tileIds: ["1", "2"] },
    { shipId: "s2", teamId: "b", tileIds: ["3"] },
    { shipId: "own", teamId: "a", tileIds: ["9"] },
  ]

  it("returns only fully hit opponent ships", () => {
    const hits = ["1", "2", "9"].map((tileId) => ({
      tileId,
      attackerTeamId: "a",
    }))
    expect(getSunkShips(ships, hits, "a").map((s) => s.shipId)).toEqual(["s1"])
  })
})
