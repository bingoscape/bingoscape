import { validateShipPlacements } from "@/lib/validate-ship-placements"
import type { TileCoord } from "@/lib/ship-placement"

const grid5x5: TileCoord[] = Array.from({ length: 25 }, (_, index) => {
  const col = index % 5
  const row = Math.floor(index / 5)
  return { id: `t-${col}-${row}`, col, row }
})

const rules = [
  { length: 3, count: 2 },
  { length: 2, count: 1 },
]

describe("validateShipPlacements", () => {
  it("returns error when no ships placed", () => {
    expect(validateShipPlacements(rules, [], grid5x5)).toBe("No ships placed")
  })

  it("accepts valid horizontal and vertical placements", () => {
    const placements = [
      { length: 3, tileIds: ["t-0-0", "t-1-0", "t-2-0"] },
      { length: 2, tileIds: ["t-0-4", "t-0-3"] },
      { length: 3, tileIds: ["t-4-0", "t-4-1", "t-4-2"] },
    ]
    expect(validateShipPlacements(rules, placements, grid5x5)).toBeNull()
  })

  it("rejects overlapping tiles across ships", () => {
    const placements = [
      { length: 3, tileIds: ["t-0-0", "t-1-0", "t-2-0"] },
      { length: 2, tileIds: ["t-2-0", "t-1-0"] },
      { length: 3, tileIds: ["t-4-0", "t-4-1", "t-4-2"] },
    ]
    expect(validateShipPlacements(rules, placements, grid5x5)).toBe(
      "Overlapping ship tiles"
    )
  })

  it("rejects non-contiguous placements", () => {
    expect(
      validateShipPlacements(
        rules,
        [{ length: 3, tileIds: ["t-0-0", "t-1-0", "t-2-1"] }],
        grid5x5
      )
    ).toBe("Ships must be straight contiguous lines")
  })

  it("rejects wrong ship counts per length", () => {
    const error = validateShipPlacements(
      rules,
      [{ length: 3, tileIds: ["t-0-0", "t-1-0", "t-2-0"] }],
      grid5x5
    )
    expect(error).toMatch(/^Expected \d+ ships of length/)
  })

  it("rejects unexpected ship lengths", () => {
    const placements = [
      { length: 4, tileIds: ["t-0-0", "t-1-0", "t-2-0", "t-3-0"] },
      { length: 3, tileIds: ["t-0-4", "t-1-4", "t-2-4"] },
      { length: 3, tileIds: ["t-4-0", "t-4-1", "t-4-2"] },
      { length: 2, tileIds: ["t-0-3", "t-1-3"] },
    ]
    expect(validateShipPlacements(rules, placements, grid5x5)).toBe(
      "Unexpected ship length 4"
    )
  })

  it("rejects invalid tile ids", () => {
    expect(
      validateShipPlacements(
        rules,
        [{ length: 2, tileIds: ["t-0-0", "not-a-tile"] }],
        grid5x5
      )
    ).toBe("Invalid tile not-a-tile")
  })

  it("rejects length mismatch between ship length and tile count", () => {
    expect(
      validateShipPlacements(
        rules,
        [{ length: 3, tileIds: ["t-0-0", "t-1-0"] }],
        grid5x5
      )
    ).toBe("Ship length 3 does not match tile count 2")
  })

  it("rejects placements on hidden tiles", () => {
    expect(
      validateShipPlacements(
        rules,
        [{ length: 2, tileIds: ["t-0-0", "t-1-0"] }],
        grid5x5,
        { hiddenTileIds: new Set(["t-0-0"]) }
      )
    ).toBe("Cannot place ships on hidden tiles")
  })
})
