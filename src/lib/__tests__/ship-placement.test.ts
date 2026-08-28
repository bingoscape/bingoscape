import {
  canAddTileToShip,
  isStraightContiguous,
  indexToCoord,
} from "@/lib/ship-placement"

const tiles = [
  { id: "a", col: 0, row: 0 },
  { id: "b", col: 1, row: 0 },
  { id: "c", col: 2, row: 0 },
  { id: "d", col: 0, row: 1 },
  { id: "e", col: 1, row: 1 },
]

describe("ship-placement", () => {
  it("indexToCoord maps row-major indices", () => {
    expect(indexToCoord(0, 3)).toEqual({ col: 0, row: 0 })
    expect(indexToCoord(4, 3)).toEqual({ col: 1, row: 1 })
  })

  it("accepts horizontal contiguous lines", () => {
    expect(isStraightContiguous(["a", "b", "c"], tiles)).toBe(true)
  })

  it("accepts vertical contiguous lines", () => {
    expect(isStraightContiguous(["a", "d"], tiles)).toBe(true)
  })

  it("rejects diagonal lines", () => {
    expect(isStraightContiguous(["a", "b", "d"], tiles)).toBe(false)
  })

  it("rejects gaps within a line", () => {
    expect(isStraightContiguous(["a", "c"], tiles)).toBe(false)
  })

  it("canAddTileToShip only allows extending from endpoints", () => {
    expect(canAddTileToShip("b", ["a"], tiles)).toBe(true)
    expect(canAddTileToShip("d", ["a", "b"], tiles)).toBe(false)
  })

  it("allows building a full ship step by step", () => {
    const built: string[] = []
    expect(canAddTileToShip("a", built, tiles)).toBe(true)
    built.push("a")
    expect(canAddTileToShip("b", built, tiles)).toBe(true)
    built.push("b")
    expect(canAddTileToShip("c", built, tiles)).toBe(true)
    expect(isStraightContiguous(built, tiles)).toBe(true)
  })
})
