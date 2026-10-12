import {
  EMPTY_MARK_SETS,
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
