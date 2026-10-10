/**
 * Pure maths for the "fit board" layout.
 *
 * The CSS in `globals.css` (`.osrs-board-fit`) sizes every Tile slot with
 *
 *   --s: max(36px, min(
 *     (100cqw - 2*p - 2px - (cols-1)*g) / cols,
 *     (100cqh - 2*p - 2px - vgaps*g) / rows))
 *
 * where `g = p = clamp(2px, 1cqmin, 10px)` and 2px is the board frame border. These helpers mirror that formula
 * in TypeScript so it can be unit tested and used for non-CSS decisions.
 */

/** Smallest Tile slot edge in px. Below this the pane scrolls instead. */
export const MIN_TILE_PX = 36
/** Below this Tile slot edge only the image is shown (no title, no XP). */
export const COMPACT_TILE_PX = 44
/** Combined left+right (or top+bottom) border of the board frame. */
export const FRAME_PX = 2
export const MIN_GAP_PX = 2
export const MAX_GAP_PX = 10
/** Height of a tier header band, in Tile slot units. */
export const TIER_HEADER_ROWS = 0.45

export interface FitInput {
  /** Pane (size container) inner width in px. */
  paneWidth: number
  /** Pane (size container) inner height in px. */
  paneHeight: number
  cols: number
  /** Effective row count. May be fractional for tier ladders. */
  rows: number
  /**
   * Number of vertical gaps between rows. Defaults to `rows - 1`, which is
   * right for a plain grid.
   */
  vgaps?: number
}

export interface FitResult {
  /** Gap between slots and padding around the board, in px. */
  gap: number
  /** Slot edge length in px (never below MIN_TILE_PX). */
  tile: number
  /** Total rendered board width in px. */
  width: number
  /** Total rendered board height in px. */
  height: number
  /** True when the floor kicked in and the board no longer fits the pane. */
  overflows: boolean
}

/** `clamp(2px, 1cqmin, 10px)` where 1cqmin is 1% of the smaller pane side. */
export function boardGap(paneWidth: number, paneHeight: number): number {
  const cqmin = Math.min(paneWidth, paneHeight) / 100
  return Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, cqmin))
}

export function computeFit(input: FitInput): FitResult {
  const { paneWidth, paneHeight, cols } = input
  const rows = Math.max(input.rows, 1)
  const vgaps = input.vgaps ?? Math.max(rows - 1, 0)
  const safeCols = Math.max(cols, 1)

  const gap = boardGap(paneWidth, paneHeight)
  const padding = gap

  const byWidth =
    (paneWidth - 2 * padding - FRAME_PX - (safeCols - 1) * gap) / safeCols
  const byHeight = (paneHeight - 2 * padding - FRAME_PX - vgaps * gap) / rows

  const tile = Math.max(MIN_TILE_PX, Math.min(byWidth, byHeight))
  const width = safeCols * tile + (safeCols - 1) * gap + 2 * padding + FRAME_PX
  const height = rows * tile + vgaps * gap + 2 * padding + FRAME_PX

  return {
    gap,
    tile,
    width,
    height,
    // Allow sub-pixel rounding noise.
    overflows: width > paneWidth + 0.5 || height > paneHeight + 0.5,
  }
}

/** Width-only variant used on mobile, where the page scrolls vertically. */
export function computeFitByWidth(
  paneWidth: number,
  cols: number
): Pick<FitResult, "gap" | "tile" | "width" | "overflows"> {
  const safeCols = Math.max(cols, 1)
  const gap = Math.min(MAX_GAP_PX, Math.max(MIN_GAP_PX, paneWidth / 100))
  const tile = Math.max(
    MIN_TILE_PX,
    (paneWidth - 2 * gap - FRAME_PX - (safeCols - 1) * gap) / safeCols
  )
  const width = safeCols * tile + (safeCols - 1) * gap + 2 * gap + FRAME_PX
  return { gap, tile, width, overflows: width > paneWidth + 0.5 }
}

export interface TierLadderMetrics {
  /** Effective rows: Tile rows plus a fractional header row per tier. */
  rows: number
  /** Vertical gaps (header-to-tiles, between Tile rows, between tiers). */
  vgaps: number
}

/**
 * Effective geometry of a tier ladder: one band per tier, each made of a thin
 * header (TIER_HEADER_ROWS of a slot) followed by that tier's Tiles wrapped at
 * `cols`. Empty tiers still get a header band.
 */
export function tierLadderMetrics(
  tierTileCounts: number[],
  cols: number
): TierLadderMetrics {
  const safeCols = Math.max(cols, 1)
  const tiers = tierTileCounts.length
  if (tiers === 0) return { rows: 1, vgaps: 0 }

  let tileRows = 0
  let vgaps = 0
  for (const count of tierTileCounts) {
    const rowsInTier = Math.ceil(count / safeCols)
    tileRows += rowsInTier
    // header -> first row gap (if any rows) + gaps between this tier's rows
    vgaps += rowsInTier > 0 ? rowsInTier : 0
  }
  // gaps between consecutive tier bands
  vgaps += tiers - 1

  return { rows: tileRows + tiers * TIER_HEADER_ROWS, vgaps }
}

/** Whether a slot of this size should hide its title and XP number. */
export function isCompactTile(tilePx: number): boolean {
  return tilePx < COMPACT_TILE_PX
}

/** Roving-tabindex arrow navigation on a row-major grid. Returns new index. */
export function moveGridFocus(
  index: number,
  key: string,
  cols: number,
  total: number
): number {
  if (total <= 0) return 0
  const last = total - 1
  switch (key) {
    case "ArrowRight":
      return Math.min(index + 1, last)
    case "ArrowLeft":
      return Math.max(index - 1, 0)
    case "ArrowDown":
      return index + cols <= last ? index + cols : index
    case "ArrowUp":
      return index - cols >= 0 ? index - cols : index
    case "Home":
      return index - (index % cols)
    case "End":
      return Math.min(index - (index % cols) + cols - 1, last)
    default:
      return index
  }
}

/**
 * Like moveGridFocus, but never lands on a skippable cell (hidden Tiles for
 * players). Falls back to the current index when nothing else is reachable.
 */
export function moveGridFocusSkipping(
  index: number,
  key: string,
  cols: number,
  total: number,
  isSkippable: (index: number) => boolean
): number {
  const step =
    key === "ArrowRight"
      ? 1
      : key === "ArrowLeft"
        ? -1
        : key === "ArrowDown"
          ? cols
          : key === "ArrowUp"
            ? -cols
            : 0

  if (step !== 0) {
    let next = index
    for (;;) {
      const candidate = moveGridFocus(next, key, cols, total)
      if (candidate === next) return index
      if (!isSkippable(candidate)) return candidate
      next = candidate
    }
  }

  if (key === "Home" || key === "End") {
    const rowStart = index - (index % cols)
    const rowEnd = Math.min(rowStart + cols - 1, total - 1)
    const range: number[] = []
    for (let i = rowStart; i <= rowEnd; i++) range.push(i)
    if (key === "End") range.reverse()
    return range.find((i) => !isSkippable(i)) ?? index
  }

  return index
}

export interface LadderCell {
  /** Visual row among Tile rows (headers not counted). */
  row: number
  /** 0-based column. */
  col: number
}

/**
 * Roving-tabindex navigation for tier ladders, where each band wraps at the
 * column count and band boundaries make "index + cols" meaningless. Cells are
 * in reading order. Up/down pick the cell in the neighbouring row whose column
 * is closest (preferring the same column). Hidden cells are skipped.
 */
export function moveLadderFocus(
  cells: LadderCell[],
  index: number,
  key: string,
  isSkippable: (index: number) => boolean
): number {
  const current = cells[index]
  if (!current) return index
  const available = (i: number) => !isSkippable(i)

  switch (key) {
    case "ArrowRight": {
      for (let i = index + 1; i < cells.length; i++) if (available(i)) return i
      return index
    }
    case "ArrowLeft": {
      for (let i = index - 1; i >= 0; i--) if (available(i)) return i
      return index
    }
    case "ArrowDown":
    case "ArrowUp": {
      const dir = key === "ArrowDown" ? 1 : -1
      // nearest row in that direction that has an available cell
      let targetRow: number | null = null
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!
        if (!available(i)) continue
        const delta = (cell.row - current.row) * dir
        if (delta > 0 && (targetRow === null || delta < targetRow)) {
          targetRow = delta
        }
      }
      if (targetRow === null) return index
      const wantedRow = current.row + targetRow * dir
      let best = -1
      let bestDist = Infinity
      cells.forEach((cell, i) => {
        if (!available(i) || cell.row !== wantedRow) return
        const dist = Math.abs(cell.col - current.col)
        if (dist < bestDist) {
          best = i
          bestDist = dist
        }
      })
      return best >= 0 ? best : index
    }
    case "Home":
    case "End": {
      const sameRow = cells
        .map((cell, i) => ({ cell, i }))
        .filter(({ cell, i }) => cell.row === current.row && available(i))
      if (sameRow.length === 0) return index
      return (key === "Home" ? sameRow[0] : sameRow[sameRow.length - 1])!.i
    }
    default:
      return index
  }
}
