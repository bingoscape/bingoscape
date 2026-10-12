/**
 * @jest-environment node
 */
import {
  findNextTileWithoutGoals,
  formatTilesWithoutGoals,
  getTilesWithoutGoals,
  lacksGoals,
  type NextTileWithoutGoals,
} from "@/lib/board-health"

interface TestTile {
  id: string
  index: number
  isHidden: boolean
  goals?: unknown[] | null
}

const tile = (
  index: number,
  goalCount: number | undefined,
  overrides: Partial<TestTile> = {}
): TestTile => ({
  id: `t${index}`,
  index,
  isHidden: false,
  goals:
    goalCount === undefined
      ? undefined
      : Array.from({ length: goalCount }, (_, i) => ({ id: `g${index}-${i}` })),
  ...overrides,
})

const ids = (tiles: { id: string }[]) => tiles.map((t) => t.id)

describe("lacksGoals", () => {
  it("is true for a visible tile with an empty goal list", () => {
    expect(lacksGoals(tile(0, 0))).toBe(true)
  })

  it("is false for a tile with goals", () => {
    expect(lacksGoals(tile(0, 2))).toBe(false)
  })

  it("is false for a hidden tile, with or without goals", () => {
    expect(lacksGoals(tile(0, 0, { isHidden: true }))).toBe(false)
    expect(lacksGoals(tile(0, 1, { isHidden: true }))).toBe(false)
  })

  it("is false when the goals were not loaded", () => {
    expect(lacksGoals(tile(0, undefined))).toBe(false)
    expect(lacksGoals(tile(0, 0, { goals: null }))).toBe(false)
  })
})

describe("getTilesWithoutGoals", () => {
  it("returns the tiles without goals in board order", () => {
    const tiles = [tile(2, 0), tile(0, 1), tile(1, 0), tile(3, 0)]
    expect(ids(getTilesWithoutGoals(tiles))).toEqual(["t1", "t2", "t3"])
  })

  it("does not reorder the input", () => {
    const tiles = [tile(2, 0), tile(0, 0)]
    getTilesWithoutGoals(tiles)
    expect(ids(tiles)).toEqual(["t2", "t0"])
  })

  it("skips hidden tiles even though they have no goals", () => {
    const tiles = [tile(0, 0, { isHidden: true }), tile(1, 0), tile(2, 3)]
    expect(ids(getTilesWithoutGoals(tiles))).toEqual(["t1"])
  })

  it("is empty when every tile has goals or the board is empty", () => {
    expect(getTilesWithoutGoals([tile(0, 1), tile(1, 4)])).toEqual([])
    expect(getTilesWithoutGoals([])).toEqual([])
  })

  it("does not count tiles whose goals are unknown", () => {
    expect(getTilesWithoutGoals([tile(0, undefined), tile(1, 0)])).toHaveLength(
      1
    )
  })
})

describe("formatTilesWithoutGoals", () => {
  it("uses the singular for one tile", () => {
    expect(formatTilesWithoutGoals(1)).toBe("1 tile has no goals")
  })

  it("uses the plural for several tiles", () => {
    expect(formatTilesWithoutGoals(2)).toBe("2 tiles have no goals")
    expect(formatTilesWithoutGoals(25)).toBe("25 tiles have no goals")
  })
})

describe("findNextTileWithoutGoals", () => {
  // t0 has goals, t1/t3/t4 do not, t2 is hidden, t5 has goals.
  const board = [
    tile(0, 1),
    tile(1, 0),
    tile(2, 0, { isHidden: true }),
    tile(3, 0),
    tile(4, 0),
    tile(5, 2),
  ]

  it("returns the first tile without goals when nothing is selected", () => {
    const next = findNextTileWithoutGoals(board, null)
    expect(next).toMatchObject({
      position: 1,
      total: 3,
      wrapped: false,
    })
    expect(next?.tile.id).toBe("t1")
  })

  it("returns the first tile without goals when the selection is not on this board", () => {
    expect(findNextTileWithoutGoals(board, "elsewhere")?.tile.id).toBe("t1")
  })

  it("continues after a selected tile that has goals", () => {
    const next = findNextTileWithoutGoals(board, "t0")
    expect(next?.tile.id).toBe("t1")
    expect(next?.wrapped).toBe(false)
  })

  it("moves on to the next one when the selected tile is itself without goals", () => {
    const next = findNextTileWithoutGoals(board, "t1")
    expect(next?.tile.id).toBe("t3")
    expect(next).toMatchObject({ position: 2, total: 3, wrapped: false })
  })

  it("skips hidden tiles", () => {
    expect(findNextTileWithoutGoals(board, "t1")?.tile.id).not.toBe("t2")
  })

  it("wraps around at the end of the board", () => {
    const next = findNextTileWithoutGoals(board, "t4")
    expect(next?.tile.id).toBe("t1")
    expect(next).toMatchObject({ position: 1, total: 3, wrapped: true })
  })

  it("wraps around from a trailing tile that has goals", () => {
    const next = findNextTileWithoutGoals(board, "t5")
    expect(next?.tile.id).toBe("t1")
    expect(next?.wrapped).toBe(true)
  })

  it("returns the selected tile itself when it is the only one without goals", () => {
    const tiles = [tile(0, 1), tile(1, 0), tile(2, 1)]
    const next = findNextTileWithoutGoals(tiles, "t1")
    expect(next?.tile.id).toBe("t1")
    expect(next).toMatchObject({ position: 1, total: 1, wrapped: true })
  })

  it("returns null when every tile has goals", () => {
    expect(findNextTileWithoutGoals([tile(0, 1), tile(1, 1)], "t0")).toBeNull()
  })

  it("returns null for an empty board", () => {
    expect(findNextTileWithoutGoals([], null)).toBeNull()
  })

  it("walks in board order even when the array is not sorted", () => {
    const shuffled = [tile(4, 0), tile(1, 0), tile(3, 0)]
    expect(findNextTileWithoutGoals(shuffled, "t1")?.tile.id).toBe("t3")
    expect(findNextTileWithoutGoals(shuffled, "t3")?.tile.id).toBe("t4")
    expect(findNextTileWithoutGoals(shuffled, "t4")?.tile.id).toBe("t1")
  })

  it("visits every tile without goals exactly once when stepped repeatedly", () => {
    const seen: string[] = []
    let current: string | null = null
    for (let i = 0; i < 3; i++) {
      const next: NextTileWithoutGoals<TestTile> | null =
        findNextTileWithoutGoals(board, current)
      if (!next) throw new Error("expected a tile without goals")
      seen.push(next.tile.id)
      current = next.tile.id
    }
    expect(seen).toEqual(["t1", "t3", "t4"])
  })
})
