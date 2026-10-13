import {
  EMPTY_MARK_SETS,
  EMPTY_OWN_SHIPS,
  shipSegmentsByTile,
  shipsForViewedTeam,
  markForTile,
  marksForViewedTeam,
  newlySunkTileIds,
  toMarkSets,
} from "../battleship-marks"

const ids = {
  hitTileIds: ["a", "b"],
  missTileIds: ["c"],
  sunkTileIds: ["b"],
}

describe("markForTile", () => {
  const sets = toMarkSets(ids)

  it("maps each state and lets sunk win over hit", () => {
    expect(markForTile("a", sets)).toBe("hit")
    expect(markForTile("b", sets)).toBe("sunk")
    expect(markForTile("c", sets)).toBe("miss")
  })

  it("has nothing for untouched Tiles or without sets", () => {
    expect(markForTile("z", sets)).toBeNull()
    expect(markForTile("a", undefined)).toBeNull()
    expect(markForTile("a", EMPTY_MARK_SETS)).toBeNull()
  })
})

describe("marksForViewedTeam", () => {
  it("applies the viewer's results to the viewer's own Team only", () => {
    expect(markForTile("a", marksForViewedTeam(ids, "t1", "t1"))).toBe("hit")
    expect(markForTile("a", marksForViewedTeam(ids, "t1", "t2"))).toBeNull()
  })

  it("has nothing for people on no Team or boards without marks", () => {
    expect(marksForViewedTeam(ids, null, "t1")).toBe(EMPTY_MARK_SETS)
    expect(marksForViewedTeam(ids, undefined, undefined)).toBe(EMPTY_MARK_SETS)
    expect(marksForViewedTeam(null, "t1", "t1")).toBe(EMPTY_MARK_SETS)
  })
})

describe("newlySunkTileIds", () => {
  it("returns only Tiles that were not sunk before", () => {
    expect(newlySunkTileIds(new Set(["a"]), ["a", "b", "c"])).toEqual([
      "b",
      "c",
    ])
  })

  it("returns nothing when the set is unchanged or shrank", () => {
    expect(newlySunkTileIds(new Set(["a", "b"]), ["a", "b"])).toEqual([])
    expect(newlySunkTileIds(new Set(["a", "b"]), ["a"])).toEqual([])
    expect(newlySunkTileIds(new Set(["a"]), [])).toEqual([])
  })
})

describe("shipsForViewedTeam", () => {
  const ships = [{ length: 2, tileIds: ["a", "b"] }]

  it("returns the ships while the viewer's own Team is on screen", () => {
    expect(shipsForViewedTeam(ships, "t1", "t1")).toBe(ships)
  })

  it("has nothing for another Team, no Team or no ships", () => {
    expect(shipsForViewedTeam(ships, "t1", "t2")).toBe(EMPTY_OWN_SHIPS)
    expect(shipsForViewedTeam(ships, null, "t1")).toBe(EMPTY_OWN_SHIPS)
    expect(shipsForViewedTeam(ships, "t1", null)).toBe(EMPTY_OWN_SHIPS)
    expect(shipsForViewedTeam(ships, undefined, undefined)).toBe(
      EMPTY_OWN_SHIPS
    )
    expect(shipsForViewedTeam(null, "t1", "t1")).toBe(EMPTY_OWN_SHIPS)
    expect(shipsForViewedTeam(undefined, "t1", "t1")).toBe(EMPTY_OWN_SHIPS)
  })
})

describe("shipSegmentsByTile", () => {
  // 3x3 board, tile id is "t<index>":
  //   0 1 2
  //   3 4 5
  //   6 7 8
  const tiles = Array.from({ length: 9 }, (_, index) => ({
    id: `t${index}`,
    index,
  }))
  const none = { hasLeft: false, hasRight: false, hasUp: false, hasDown: false }

  it("connects a horizontal ship left to right", () => {
    const segments = shipSegmentsByTile(
      [{ length: 3, tileIds: ["t3", "t4", "t5"] }],
      3,
      tiles
    )
    expect(segments.get("t3")).toEqual({ ...none, length: 3, hasRight: true })
    expect(segments.get("t4")).toEqual({
      ...none,
      length: 3,
      hasLeft: true,
      hasRight: true,
    })
    expect(segments.get("t5")).toEqual({ ...none, length: 3, hasLeft: true })
  })

  it("connects a vertical ship top to bottom", () => {
    const segments = shipSegmentsByTile(
      [{ length: 3, tileIds: ["t0", "t3", "t6"] }],
      3,
      tiles
    )
    expect(segments.get("t0")).toEqual({ ...none, length: 3, hasDown: true })
    expect(segments.get("t3")).toEqual({
      ...none,
      length: 3,
      hasUp: true,
      hasDown: true,
    })
    expect(segments.get("t6")).toEqual({ ...none, length: 3, hasUp: true })
  })

  it("does not connect tiles of different ships or across the board edge", () => {
    // t2 (end of row 0) and t3 (start of row 1) are consecutive indexes but
    // not neighbours; t4 belongs to another ship than t3.
    const segments = shipSegmentsByTile(
      [
        { length: 1, tileIds: ["t2"] },
        { length: 1, tileIds: ["t3"] },
        { length: 1, tileIds: ["t4"] },
      ],
      3,
      tiles
    )
    expect(segments.get("t2")).toEqual({ ...none, length: 1 })
    expect(segments.get("t3")).toEqual({ ...none, length: 1 })
    expect(segments.get("t4")).toEqual({ ...none, length: 1 })
  })

  it("keys by tile id regardless of the order of the tiles", () => {
    const shuffled = [...tiles].reverse()
    const segments = shipSegmentsByTile(
      [{ length: 2, tileIds: ["t4", "t7"] }],
      3,
      shuffled
    )
    expect(segments.get("t4")).toEqual({ ...none, length: 2, hasDown: true })
    expect(segments.get("t7")).toEqual({ ...none, length: 2, hasUp: true })
    expect(segments.size).toBe(2)
  })

  it("skips unknown tiles and handles no ships or no columns", () => {
    expect(
      shipSegmentsByTile([{ length: 2, tileIds: ["t0", "gone"] }], 3, tiles)
        .size
    ).toBe(1)
    expect(shipSegmentsByTile([], 3, tiles).size).toBe(0)
    expect(
      shipSegmentsByTile([{ length: 1, tileIds: ["t0"] }], 0, tiles).size
    ).toBe(0)
  })
})
