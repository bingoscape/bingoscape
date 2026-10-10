/**
 * @jest-environment node
 */
import {
  COMPACT_TILE_PX,
  FRAME_PX,
  MIN_TILE_PX,
  TIER_HEADER_ROWS,
  boardGap,
  computeFit,
  computeFitByWidth,
  isCompactTile,
  moveGridFocus,
  moveGridFocusSkipping,
  moveLadderFocus,
  tierLadderMetrics,
} from "@/lib/board-fit"

describe("boardGap", () => {
  it("is 1% of the smaller pane side, clamped to 2..10px", () => {
    expect(boardGap(1000, 600)).toBe(6)
    expect(boardGap(100, 100)).toBe(2)
    expect(boardGap(5000, 5000)).toBe(10)
  })
})

describe("computeFit", () => {
  it("fits a square board into a landscape pane by height", () => {
    const fit = computeFit({ paneWidth: 1200, paneHeight: 700, cols: 5, rows: 5 })
    expect(fit.overflows).toBe(false)
    expect(fit.height).toBeLessThanOrEqual(700 + 0.5)
    expect(fit.width).toBeLessThanOrEqual(1200)
    // height is the limiting axis, so the board uses (almost) all of it
    expect(fit.height).toBeCloseTo(700, 0)
    expect(fit.width).toBeLessThan(700 + 1)
  })

  it("fits a square board into a portrait pane by width", () => {
    const fit = computeFit({ paneWidth: 500, paneHeight: 900, cols: 5, rows: 5 })
    expect(fit.overflows).toBe(false)
    expect(fit.width).toBeCloseTo(500, 0)
  })

  it("fits a wide 4x7 (rows x cols) board", () => {
    const fit = computeFit({ paneWidth: 1000, paneHeight: 600, cols: 7, rows: 4 })
    expect(fit.overflows).toBe(false)
    expect(fit.width).toBeLessThanOrEqual(1000.5)
    expect(fit.height).toBeLessThanOrEqual(600.5)
    // 7 columns by width is the tighter axis here
    expect(fit.width).toBeCloseTo(1000, 0)
  })

  it("fits a tall 7x4 (rows x cols) board", () => {
    const fit = computeFit({ paneWidth: 1000, paneHeight: 600, cols: 4, rows: 7 })
    expect(fit.overflows).toBe(false)
    expect(fit.height).toBeCloseTo(600, 0)
  })

  it("handles a 1x1 board", () => {
    const fit = computeFit({ paneWidth: 800, paneHeight: 500, cols: 1, rows: 1 })
    expect(fit.overflows).toBe(false)
    // no inter-slot gaps, only padding
    expect(fit.tile).toBeCloseTo(500 - 2 * fit.gap - FRAME_PX, 5)
  })

  it("never goes below the 36px floor and reports overflow", () => {
    const fit = computeFit({ paneWidth: 300, paneHeight: 300, cols: 10, rows: 10 })
    expect(fit.tile).toBe(MIN_TILE_PX)
    expect(fit.overflows).toBe(true)
  })

  it.each([
    [1920, 1080, 3, 3],
    [1366, 768, 5, 5],
    [1024, 768, 4, 7],
    [1366, 768, 7, 4],
    [1920, 1080, 10, 10],
  ])("fits %ix%i pane for %i cols x %i rows", (w, h, cols, rows) => {
    const fit = computeFit({ paneWidth: w, paneHeight: h, cols, rows })
    if (!fit.overflows) {
      expect(fit.width).toBeLessThanOrEqual(w + 0.5)
      expect(fit.height).toBeLessThanOrEqual(h + 0.5)
    }
    expect(fit.tile).toBeGreaterThanOrEqual(MIN_TILE_PX)
  })

  it("accounts for explicit vertical gap counts (tier ladder)", () => {
    const base = computeFit({ paneWidth: 800, paneHeight: 600, cols: 4, rows: 4 })
    const more = computeFit({
      paneWidth: 800,
      paneHeight: 600,
      cols: 4,
      rows: 4,
      vgaps: 9,
    })
    expect(more.tile).toBeLessThan(base.tile)
    expect(more.height).toBeLessThanOrEqual(600.5)
  })
})

describe("computeFitByWidth (mobile)", () => {
  it("only depends on width", () => {
    const fit = computeFitByWidth(390, 5)
    expect(fit.overflows).toBe(false)
    expect(fit.width).toBeCloseTo(390, 0)
  })

  it("floors tiny slots and overflows horizontally", () => {
    const fit = computeFitByWidth(360, 10)
    expect(fit.tile).toBe(MIN_TILE_PX)
    expect(fit.overflows).toBe(true)
  })
})

describe("tierLadderMetrics", () => {
  it("is a single band with a header for one tier", () => {
    const m = tierLadderMetrics([5], 5)
    expect(m.rows).toBeCloseTo(1 + TIER_HEADER_ROWS, 5)
    expect(m.vgaps).toBe(1)
  })

  it("wraps uneven tiers at the column count", () => {
    // tiers of 5, 3 and 7 tiles at 5 columns -> 1 + 1 + 2 rows, 3 headers
    const m = tierLadderMetrics([5, 3, 7], 5)
    expect(m.rows).toBeCloseTo(4 + 3 * TIER_HEADER_ROWS, 5)
    // per tier: 1, 1, 2 gaps, plus 2 between tiers
    expect(m.vgaps).toBe(1 + 1 + 2 + 2)
  })

  it("keeps a header for an empty tier", () => {
    const m = tierLadderMetrics([4, 0], 4)
    expect(m.rows).toBeCloseTo(1 + 2 * TIER_HEADER_ROWS, 5)
    expect(m.vgaps).toBe(1 + 0 + 1)
  })

  it("feeds computeFit so a tall ladder shrinks the slot size", () => {
    const small = tierLadderMetrics([5], 5)
    const tall = tierLadderMetrics([5, 5, 5, 5], 5)
    const a = computeFit({ paneWidth: 900, paneHeight: 600, cols: 5, ...small })
    const b = computeFit({ paneWidth: 900, paneHeight: 600, cols: 5, ...tall })
    expect(b.tile).toBeLessThan(a.tile)
    expect(b.height).toBeLessThanOrEqual(600.5)
  })
})

describe("isCompactTile", () => {
  it("hides meta below the compact threshold", () => {
    expect(isCompactTile(COMPACT_TILE_PX - 1)).toBe(true)
    expect(isCompactTile(COMPACT_TILE_PX)).toBe(false)
  })
})

describe("moveGridFocus (roving tabindex)", () => {
  // 3 cols x 3 rows = 9 cells
  it("moves by one with left/right and clamps at the ends", () => {
    expect(moveGridFocus(4, "ArrowRight", 3, 9)).toBe(5)
    expect(moveGridFocus(4, "ArrowLeft", 3, 9)).toBe(3)
    expect(moveGridFocus(0, "ArrowLeft", 3, 9)).toBe(0)
    expect(moveGridFocus(8, "ArrowRight", 3, 9)).toBe(8)
  })

  it("moves by a row with up/down and stays put at edges", () => {
    expect(moveGridFocus(4, "ArrowDown", 3, 9)).toBe(7)
    expect(moveGridFocus(4, "ArrowUp", 3, 9)).toBe(1)
    expect(moveGridFocus(7, "ArrowDown", 3, 9)).toBe(7)
    expect(moveGridFocus(1, "ArrowUp", 3, 9)).toBe(1)
  })

  it("Home/End jump to the row start/end", () => {
    expect(moveGridFocus(4, "Home", 3, 9)).toBe(3)
    expect(moveGridFocus(4, "End", 3, 9)).toBe(5)
  })

  it("End clamps on a short last row", () => {
    // 8 cells, 3 cols: last row has 2 cells
    expect(moveGridFocus(6, "End", 3, 8)).toBe(7)
  })

  it("ignores other keys", () => {
    expect(moveGridFocus(4, "a", 3, 9)).toBe(4)
  })
})

describe("moveGridFocusSkipping (hidden Tiles are skipped for players)", () => {
  const hidden = new Set([4, 5])
  const skip = (i: number) => hidden.has(i)

  it("steps over hidden cells horizontally", () => {
    // 4 and 5 are hidden, so right from 3 continues to the next row's start
    expect(moveGridFocusSkipping(3, "ArrowRight", 3, 9, skip)).toBe(6)
    expect(moveGridFocusSkipping(2, "ArrowRight", 3, 9, skip)).toBe(3)
    expect(moveGridFocusSkipping(6, "ArrowLeft", 3, 9, skip)).toBe(3)
  })

  it("steps over hidden cells vertically", () => {
    expect(moveGridFocusSkipping(1, "ArrowDown", 3, 9, skip)).toBe(7)
    expect(moveGridFocusSkipping(7, "ArrowUp", 3, 9, skip)).toBe(1)
  })

  it("Home/End land on the nearest visible cell in the row", () => {
    expect(moveGridFocusSkipping(3, "End", 3, 9, skip)).toBe(3)
    expect(moveGridFocusSkipping(3, "Home", 3, 9, skip)).toBe(3)
  })

  it("stays put when nothing is reachable", () => {
    const all = () => true
    expect(moveGridFocusSkipping(0, "ArrowRight", 3, 9, all)).toBe(0)
  })
})

describe("moveLadderFocus (tier ladder with uneven bands)", () => {
  // 3 columns: tier 0 has 4 tiles (rows 0,1 -> last row has one cell), tier 1
  // has 2 tiles (row 2).
  const cells = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
    { row: 1, col: 0 },
    { row: 2, col: 0 },
    { row: 2, col: 1 },
  ]
  const none = () => false

  it("moves left/right in reading order", () => {
    expect(moveLadderFocus(cells, 2, "ArrowRight", none)).toBe(3)
    expect(moveLadderFocus(cells, 3, "ArrowLeft", none)).toBe(2)
    expect(moveLadderFocus(cells, 5, "ArrowRight", none)).toBe(5)
  })

  it("moves down to the same column, or the closest one", () => {
    expect(moveLadderFocus(cells, 0, "ArrowDown", none)).toBe(3)
    // from (0,2) the next row only has col 0
    expect(moveLadderFocus(cells, 2, "ArrowDown", none)).toBe(3)
    // across the band boundary: (1,0) -> (2,0)
    expect(moveLadderFocus(cells, 3, "ArrowDown", none)).toBe(4)
  })

  it("moves up and stays at the top", () => {
    expect(moveLadderFocus(cells, 5, "ArrowUp", none)).toBe(3)
    expect(moveLadderFocus(cells, 1, "ArrowUp", none)).toBe(1)
  })

  it("Home/End stay within the row", () => {
    expect(moveLadderFocus(cells, 1, "Home", none)).toBe(0)
    expect(moveLadderFocus(cells, 1, "End", none)).toBe(2)
    expect(moveLadderFocus(cells, 5, "Home", none)).toBe(4)
  })

  it("skips hidden cells, including whole rows", () => {
    const hidden = new Set([3])
    const skip = (i: number) => hidden.has(i)
    // row 1 is entirely hidden, so down from row 0 lands in row 2
    expect(moveLadderFocus(cells, 0, "ArrowDown", skip)).toBe(4)
    expect(moveLadderFocus(cells, 4, "ArrowUp", skip)).toBe(0)
  })
})
