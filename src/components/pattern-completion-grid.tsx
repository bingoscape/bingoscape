"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check } from "lucide-react"
import type { PatternCompletionResult } from "@/app/actions/pattern-completion"

interface PatternCompletionGridProps {
  patterns: PatternCompletionResult
  teamName: string
  rows: number
  columns: number
  completedTileIndices: Set<number>
}

export function PatternCompletionGrid({
  patterns,
  teamName,
  rows,
  columns,
  completedTileIndices,
}: PatternCompletionGridProps) {
  // Create a set of completed row/column indices for quick lookup
  const completedRowIndices = new Set(patterns.completedRows.map((r) => r.index!))
  const completedColumnIndices = new Set(patterns.completedColumns.map((c) => c.index!))

  // Check if a tile is on the main diagonal
  const isOnMainDiagonal = (index: number): boolean => {
    if (rows !== columns) return false
    const row = Math.floor(index / columns)
    const col = index % columns
    return row === col
  }

  // Check if a tile is on the anti-diagonal
  const isOnAntiDiagonal = (index: number): boolean => {
    if (rows !== columns) return false
    const row = Math.floor(index / columns)
    const col = index % columns
    return row + col === rows - 1
  }

  // Determine tile style based on completion patterns
  const getTileStyle = (index: number) => {
    const row = Math.floor(index / columns)
    const col = index % columns
    const isCompleted = completedTileIndices.has(index)

    const classes = ["relative border aspect-square flex items-center justify-center"]

    // Base color
    if (isCompleted) {
      classes.push("bg-green-100 border-green-300")
    } else {
      classes.push("bg-gray-100 border-gray-300")
    }

    // Highlight if part of completed row
    if (completedRowIndices.has(row)) {
      classes.push("border-r-4 border-r-green-600")
    }

    // Highlight if part of completed column
    if (completedColumnIndices.has(col)) {
      classes.push("border-b-4 border-b-blue-600")
    }

    // Highlight if on completed main diagonal
    if (patterns.mainDiagonal && isOnMainDiagonal(index)) {
      classes.push("border-4 border-purple-600")
    }

    // Highlight if on completed anti-diagonal
    if (patterns.antiDiagonal && isOnAntiDiagonal(index)) {
      classes.push("border-4 border-purple-600")
    }

    return classes.join(" ")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{teamName}</CardTitle>
        <CardDescription>Pattern Completion Visual</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Legend */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-green-100 border-2 border-green-600"></div>
              <span>Completed Tile</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-r-4 border-r-green-600"></div>
              <span>Completed Row</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-gray-100 border-b-4 border-b-blue-600"></div>
              <span>Completed Column</span>
            </div>
            {rows === columns && (
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-gray-100 border-4 border-purple-600"></div>
                <span>Completed Diagonal</span>
              </div>
            )}
          </div>

          {/* Grid */}
          <div
            className="grid gap-1 w-fit mx-auto"
            style={{
              gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: rows * columns }).map((_, index) => (
              <div key={index} className={getTileStyle(index)}>
                {completedTileIndices.has(index) && (
                  <Check className="w-4 h-4 text-green-700" />
                )}
              </div>
            ))}
          </div>

          {/* Row Labels with Bonuses */}
          {patterns.completedRows.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Row Bonuses:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {patterns.completedRows.map((row) => (
                  <div key={`row-label-${row.index}`} className="flex justify-between">
                    <span>Row {row.index! + 1}:</span>
                    <span className="font-medium text-green-600">+{row.bonusXP} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Column Labels with Bonuses */}
          {patterns.completedColumns.length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Column Bonuses:</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {patterns.completedColumns.map((col) => (
                  <div key={`col-label-${col.index}`} className="flex justify-between">
                    <span>Column {col.index! + 1}:</span>
                    <span className="font-medium text-blue-600">+{col.bonusXP} XP</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Diagonal Labels with Bonuses */}
          {((patterns.mainDiagonal ?? false) || (patterns.antiDiagonal ?? false)) && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">Diagonal Bonuses:</h4>
              <div className="grid grid-cols-1 gap-2 text-sm">
                {patterns.mainDiagonal && (
                  <div className="flex justify-between">
                    <span>Main Diagonal:</span>
                    <span className="font-medium text-purple-600">
                      +{patterns.mainDiagonal.bonusXP} XP
                    </span>
                  </div>
                )}
                {patterns.antiDiagonal && (
                  <div className="flex justify-between">
                    <span>Anti-Diagonal:</span>
                    <span className="font-medium text-purple-600">
                      +{patterns.antiDiagonal.bonusXP} XP
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
