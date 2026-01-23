"use server"

import { db } from "@/server/db"
import { tiles, teamTileSubmissions, bingos } from "@/server/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export interface TilePosition {
  row: number
  col: number
}

export interface CompletedPattern {
  type: "row" | "column" | "main-diagonal" | "anti-diagonal" | "complete-board"
  index?: number // For rows and columns
  bonusXP: number
}

export interface PatternCompletionResult {
  completedRows: CompletedPattern[]
  completedColumns: CompletedPattern[]
  mainDiagonal: CompletedPattern | null
  antiDiagonal: CompletedPattern | null
  completeBoard: CompletedPattern | null
  totalBonusXP: number
}

// This function is currently unused but may be needed for future features
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function getTilePosition(index: number, columns: number): TilePosition {
  const row = Math.floor(index / columns)
  const col = index % columns
  return { row, col }
}

/**
 * Get all tile indices for a specific row
 */
function getRowIndices(
  row: number,
  columns: number,
  totalTiles: number
): number[] {
  const startIndex = row * columns
  const endIndex = Math.min(startIndex + columns, totalTiles)
  return Array.from({ length: endIndex - startIndex }, (_, i) => startIndex + i)
}

/**
 * Get all tile indices for a specific column
 */
function getColumnIndices(
  col: number,
  rows: number,
  columns: number
): number[] {
  const indices: number[] = []
  for (let row = 0; row < rows; row++) {
    const index = row * columns + col
    indices.push(index)
  }
  return indices
}

/**
 * Get all tile indices for the main diagonal (top-left to bottom-right)
 * Only valid for square boards
 */
function getMainDiagonalIndices(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i * size + i)
}

/**
 * Get all tile indices for the anti-diagonal (top-right to bottom-left)
 * Only valid for square boards
 */
function getAntiDiagonalIndices(size: number): number[] {
  return Array.from({ length: size }, (_, i) => i * size + (size - 1 - i))
}

/**
 * Check if a pattern (set of tile indices) is completed by a team
 */
async function checkPatternCompletion(
  tileIndices: number[],
  bingoId: string,
  teamId: string,
  allTiles: { id: string; index: number }[]
): Promise<boolean> {
  // Get tile IDs for the given indices
  const tileIds = tileIndices
    .map((index) => allTiles.find((t) => t.index === index)?.id)
    .filter((id): id is string => id !== undefined)

  if (tileIds.length !== tileIndices.length) {
    // Not all tiles exist for this pattern
    return false
  }

  // Check if all these tiles have approved submissions for the team
  const completedTiles = await db
    .select({ tileId: teamTileSubmissions.tileId })
    .from(teamTileSubmissions)
    .where(
      and(
        eq(teamTileSubmissions.teamId, teamId),
        eq(teamTileSubmissions.status, "approved"),
        inArray(teamTileSubmissions.tileId, tileIds)
      )
    )

  return completedTiles.length === tileIds.length
}

/**
 * Get all completed patterns and their bonuses for a team on a bingo board
 */
export async function getCompletedPatterns(
  bingoId: string,
  teamId: string
): Promise<PatternCompletionResult> {
  // Fetch bingo board details
  const bingo = await db.query.bingos.findFirst({
    where: eq(bingos.id, bingoId),
    with: {
      rowBonuses: true,
      columnBonuses: true,
    },
  })

  if (!bingo || bingo.bingoType !== "standard") {
    // Only standard boards support pattern bonuses
    return {
      completedRows: [],
      completedColumns: [],
      mainDiagonal: null,
      antiDiagonal: null,
      completeBoard: null,
      totalBonusXP: 0,
    }
  }

  // Fetch all tiles for this bingo
  const allTiles = await db.query.tiles.findMany({
    where: eq(tiles.bingoId, bingoId),
    columns: {
      id: true,
      index: true,
    },
  })

  const result: PatternCompletionResult = {
    completedRows: [],
    completedColumns: [],
    mainDiagonal: null,
    antiDiagonal: null,
    completeBoard: null,
    totalBonusXP: 0,
  }

  // Check rows
  for (let row = 0; row < bingo.rows; row++) {
    const rowIndices = getRowIndices(row, bingo.columns, allTiles.length)
    const isComplete = await checkPatternCompletion(
      rowIndices,
      bingoId,
      teamId,
      allTiles
    )

    if (isComplete) {
      const bonus = bingo.rowBonuses.find((rb) => rb.rowIndex === row)
      const bonusXP = bonus?.bonusXP ?? 0

      if (bonusXP > 0) {
        result.completedRows.push({
          type: "row",
          index: row,
          bonusXP,
        })
        result.totalBonusXP += bonusXP
      }
    }
  }

  // Check columns
  for (let col = 0; col < bingo.columns; col++) {
    const colIndices = getColumnIndices(col, bingo.rows, bingo.columns)
    const isComplete = await checkPatternCompletion(
      colIndices,
      bingoId,
      teamId,
      allTiles
    )

    if (isComplete) {
      const bonus = bingo.columnBonuses.find((cb) => cb.columnIndex === col)
      const bonusXP = bonus?.bonusXP ?? 0

      if (bonusXP > 0) {
        result.completedColumns.push({
          type: "column",
          index: col,
          bonusXP,
        })
        result.totalBonusXP += bonusXP
      }
    }
  }

  // Check diagonals (only for square boards)
  if (bingo.rows === bingo.columns) {
    const size = bingo.rows

    // Main diagonal
    if (bingo.mainDiagonalBonusXP > 0) {
      const mainDiagIndices = getMainDiagonalIndices(size)
      const isComplete = await checkPatternCompletion(
        mainDiagIndices,
        bingoId,
        teamId,
        allTiles
      )

      if (isComplete) {
        result.mainDiagonal = {
          type: "main-diagonal",
          bonusXP: bingo.mainDiagonalBonusXP,
        }
        result.totalBonusXP += bingo.mainDiagonalBonusXP
      }
    }

    // Anti-diagonal
    if (bingo.antiDiagonalBonusXP > 0) {
      const antiDiagIndices = getAntiDiagonalIndices(size)
      const isComplete = await checkPatternCompletion(
        antiDiagIndices,
        bingoId,
        teamId,
        allTiles
      )

      if (isComplete) {
        result.antiDiagonal = {
          type: "anti-diagonal",
          bonusXP: bingo.antiDiagonalBonusXP,
        }
        result.totalBonusXP += bingo.antiDiagonalBonusXP
      }
    }
  }

  // Check complete board (all tiles completed)
  if (bingo.completeBoardBonusXP > 0) {
    const allTileIndices = Array.from({ length: allTiles.length }, (_, i) => i)
    const isComplete = await checkPatternCompletion(
      allTileIndices,
      bingoId,
      teamId,
      allTiles
    )

    if (isComplete) {
      result.completeBoard = {
        type: "complete-board",
        bonusXP: bingo.completeBoardBonusXP,
      }
      result.totalBonusXP += bingo.completeBoardBonusXP
    }
  }

  return result
}

/**
 * Calculate total bonus XP for a team on a bingo board
 */
export async function calculateBonusXP(
  bingoId: string,
  teamId: string
): Promise<number> {
  const patterns = await getCompletedPatterns(bingoId, teamId)
  return patterns.totalBonusXP
}
