"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { cn } from "@/lib/utils"

interface PatternBonusSchematicEditorProps {
  rows: number
  columns: number
  rowBonuses: Record<number, number>
  columnBonuses: Record<number, number>
  mainDiagonalBonus: number
  antiDiagonalBonus: number
  completeBoardBonus: number
  onRowBonusChange: (rowIndex: number, value: number) => void
  onColumnBonusChange: (columnIndex: number, value: number) => void
  onMainDiagonalChange: (value: number) => void
  onAntiDiagonalChange: (value: number) => void
  onCompleteBoardChange: (value: number) => void
  disabled?: boolean
}

type HoveredPattern = {
  type: "row" | "column" | "mainDiag" | "antiDiag" | "complete" | null
  index?: number
}

export function PatternBonusSchematicEditor({
  rows,
  columns,
  rowBonuses,
  columnBonuses,
  mainDiagonalBonus,
  antiDiagonalBonus,
  completeBoardBonus,
  onRowBonusChange,
  onColumnBonusChange,
  onMainDiagonalChange,
  onAntiDiagonalChange,
  onCompleteBoardChange,
  disabled = false,
}: PatternBonusSchematicEditorProps) {
  const [hoveredPattern, setHoveredPattern] = useState<HoveredPattern>({
    type: null,
  })

  const isSquare = rows === columns

  // Calculate which cells should be highlighted based on hovered pattern
  const getHighlightedCells = (): Set<number> => {
    const highlighted = new Set<number>()

    if (!hoveredPattern.type) return highlighted

    switch (hoveredPattern.type) {
      case "row":
        if (hoveredPattern.index !== undefined) {
          for (let col = 0; col < columns; col++) {
            highlighted.add(hoveredPattern.index * columns + col)
          }
        }
        break
      case "column":
        if (hoveredPattern.index !== undefined) {
          for (let row = 0; row < rows; row++) {
            highlighted.add(row * columns + hoveredPattern.index)
          }
        }
        break
      case "mainDiag":
        if (isSquare) {
          for (let i = 0; i < rows; i++) {
            highlighted.add(i * columns + i)
          }
        }
        break
      case "antiDiag":
        if (isSquare) {
          for (let i = 0; i < rows; i++) {
            highlighted.add(i * columns + (columns - 1 - i))
          }
        }
        break
      case "complete":
        for (let i = 0; i < rows * columns; i++) {
          highlighted.add(i)
        }
        break
    }

    return highlighted
  }

  const highlightedCells = getHighlightedCells()

  // Get background color for highlighted cells based on pattern type
  const getHighlightColor = (cellIndex: number): string => {
    if (!highlightedCells.has(cellIndex)) return "bg-muted/20"

    switch (hoveredPattern.type) {
      case "row":
        return "bg-green-100 border-green-300"
      case "column":
        return "bg-blue-100 border-blue-300"
      case "mainDiag":
      case "antiDiag":
        return "bg-purple-100 border-purple-300"
      case "complete":
        return "bg-amber-100 border-amber-300"
      default:
        return "bg-muted/20"
    }
  }

  // Calculate responsive cell size based on board dimensions
  const getCellSize = (): string => {
    if (rows <= 4 && columns <= 4) return "w-12 h-12"
    if (rows <= 6 && columns <= 6) return "w-10 h-10"
    if (rows <= 8 && columns <= 8) return "w-8 h-8"
    return "w-7 h-7"
  }

  const getCellSizeInPixels = (): number => {
    if (rows <= 4 && columns <= 4) return 48
    if (rows <= 6 && columns <= 6) return 40
    if (rows <= 8 && columns <= 8) return 32
    return 28
  }

  const cellSize = getCellSize()
  const cellSizePx = getCellSizeInPixels()

  return (
    <div>
      {/* Desktop schematic layout */}
      <div className="hidden md:block">
        <div className="flex flex-col items-center gap-4">
          {/* Complete Board Bonus - Top Center */}
          <div className="mb-2 flex w-full justify-center">
            <div
              className={cn(
                "rounded-lg border-2 bg-amber-50/50 p-3 transition-all",
                hoveredPattern.type === "complete"
                  ? "border-amber-400 ring-2 ring-amber-200"
                  : "border-amber-200"
              )}
            >
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="completeBoardBonus"
                  className="whitespace-nowrap text-sm font-medium"
                >
                  Complete Board Bonus:
                </Label>
                <Input
                  id="completeBoardBonus"
                  type="number"
                  min="0"
                  value={completeBoardBonus}
                  onChange={(e) =>
                    onCompleteBoardChange(
                      e.target.value === "" ? 0 : parseInt(e.target.value)
                    )
                  }
                  onMouseEnter={() => setHoveredPattern({ type: "complete" })}
                  onMouseLeave={() => setHoveredPattern({ type: null })}
                  placeholder="0"
                  className="h-10 w-28 text-sm"
                  disabled={disabled}
                />
                <span className="text-sm text-muted-foreground">XP</span>
                {completeBoardBonus > 0 && (
                  <Badge variant="default" className="bg-amber-600">
                    {completeBoardBonus} XP
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Main Grid Layout */}
          <div className="flex items-start gap-4">
            {/* Left Side: Diagonal Inputs */}
            <div
              className="flex flex-col justify-between gap-2"
              style={{
                height: `${cellSizePx + rows * cellSizePx + (rows - 1) * 8}px`,
              }}
            >
              {/* Main Diagonal (Top-Left) */}
              {isSquare && (
                <div
                  className={cn(
                    "rounded-lg border-2 bg-purple-50/50 p-2 transition-all",
                    hoveredPattern.type === "mainDiag"
                      ? "border-purple-400 ring-2 ring-purple-200"
                      : "border-purple-200"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="mainDiagonalBonus"
                      className="flex items-center gap-1 text-xs font-medium"
                    >
                      <span>↘</span>
                      <span>Main</span>
                    </Label>
                    <Input
                      id="mainDiagonalBonus"
                      type="number"
                      min="0"
                      value={mainDiagonalBonus}
                      onChange={(e) =>
                        onMainDiagonalChange(
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      onMouseEnter={() =>
                        setHoveredPattern({ type: "mainDiag" })
                      }
                      onMouseLeave={() => setHoveredPattern({ type: null })}
                      placeholder="0"
                      className="h-10 w-24 text-sm"
                      disabled={disabled}
                    />
                    {mainDiagonalBonus > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-600 text-xs text-white"
                      >
                        {mainDiagonalBonus}
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Anti Diagonal (Bottom-Left) */}
              {isSquare && (
                <div
                  className={cn(
                    "rounded-lg border-2 bg-purple-50/50 p-2 transition-all",
                    hoveredPattern.type === "antiDiag"
                      ? "border-purple-400 ring-2 ring-purple-200"
                      : "border-purple-200"
                  )}
                >
                  <div className="flex flex-col gap-1">
                    <Label
                      htmlFor="antiDiagonalBonus"
                      className="flex items-center gap-1 text-xs font-medium"
                    >
                      <span>↗</span>
                      <span>Anti</span>
                    </Label>
                    <Input
                      id="antiDiagonalBonus"
                      type="number"
                      min="0"
                      value={antiDiagonalBonus}
                      onChange={(e) =>
                        onAntiDiagonalChange(
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      onMouseEnter={() =>
                        setHoveredPattern({ type: "antiDiag" })
                      }
                      onMouseLeave={() => setHoveredPattern({ type: null })}
                      placeholder="0"
                      className="h-10 w-24 text-sm"
                      disabled={disabled}
                    />
                    {antiDiagonalBonus > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-600 text-xs text-white"
                      >
                        {antiDiagonalBonus}
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Center: Grid + Row Inputs */}
            <div className="flex gap-4">
              {/* The Grid */}
              <div className="flex flex-col gap-2">
                {/* Column Labels (Top) */}
                <div className="flex gap-2">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <div
                      key={`col-label-${colIndex}`}
                      className={cn(
                        cellSize,
                        "flex items-center justify-center text-xs font-medium transition-all",
                        hoveredPattern.type === "column" &&
                          hoveredPattern.index === colIndex
                          ? "text-blue-600"
                          : "text-muted-foreground"
                      )}
                    >
                      C{colIndex + 1}
                    </div>
                  ))}
                </div>

                {/* Grid Rows */}
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div key={`row-${rowIndex}`} className="flex gap-2">
                    {Array.from({ length: columns }).map((_, colIndex) => {
                      const cellIndex = rowIndex * columns + colIndex
                      return (
                        <div
                          key={`cell-${cellIndex}`}
                          className={cn(
                            cellSize,
                            "rounded border-2 transition-all",
                            getHighlightColor(cellIndex)
                          )}
                        />
                      )
                    })}
                  </div>
                ))}

                {/* Column Bonus Inputs (Bottom) */}
                <div className="mt-2 flex gap-2">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <div
                      key={`col-input-${colIndex}`}
                      className={cn("flex flex-col gap-1", cellSize)}
                    >
                      <Input
                        id={`columnBonus-${colIndex}`}
                        type="number"
                        min="0"
                        value={columnBonuses[colIndex] ?? 0}
                        onChange={(e) =>
                          onColumnBonusChange(
                            colIndex,
                            e.target.value === "" ? 0 : parseInt(e.target.value)
                          )
                        }
                        onMouseEnter={() =>
                          setHoveredPattern({ type: "column", index: colIndex })
                        }
                        onMouseLeave={() => setHoveredPattern({ type: null })}
                        placeholder="0"
                        className={cn(
                          "h-10 p-1 text-center text-sm transition-all",
                          hoveredPattern.type === "column" &&
                            hoveredPattern.index === colIndex
                            ? "border-blue-400 ring-2 ring-blue-200"
                            : "border-blue-200"
                        )}
                        disabled={disabled}
                      />
                      {(columnBonuses[colIndex] ?? 0) > 0 && (
                        <Badge
                          variant="secondary"
                          className="justify-center bg-blue-600 px-1 py-0 text-[10px] text-white"
                        >
                          {columnBonuses[colIndex]}
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Row Inputs */}
              <div className="flex flex-col gap-2">
                {/* Empty space for column labels */}
                <div style={{ height: `${cellSizePx}px` }} />

                {/* Row Bonus Inputs */}
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div
                    key={`row-input-${rowIndex}`}
                    className={cn("flex items-center gap-2", cellSize)}
                  >
                    <Input
                      id={`rowBonus-${rowIndex}`}
                      type="number"
                      min="0"
                      value={rowBonuses[rowIndex] ?? 0}
                      onChange={(e) =>
                        onRowBonusChange(
                          rowIndex,
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      onMouseEnter={() =>
                        setHoveredPattern({ type: "row", index: rowIndex })
                      }
                      onMouseLeave={() => setHoveredPattern({ type: null })}
                      placeholder="0"
                      className={cn(
                        "h-10 w-24 text-sm transition-all",
                        hoveredPattern.type === "row" &&
                          hoveredPattern.index === rowIndex
                          ? "border-green-400 ring-2 ring-green-200"
                          : "border-green-200"
                      )}
                      disabled={disabled}
                    />
                    {(rowBonuses[rowIndex] ?? 0) > 0 && (
                      <Badge
                        variant="secondary"
                        className="bg-green-600 text-xs text-white"
                      >
                        {rowBonuses[rowIndex]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border-2 border-green-300 bg-green-100" />
              <span>Row Bonus</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border-2 border-blue-300 bg-blue-100" />
              <span>Column Bonus</span>
            </div>
            {isSquare && (
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 rounded border-2 border-purple-300 bg-purple-100" />
                <span>Diagonal Bonus</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded border-2 border-amber-300 bg-amber-100" />
              <span>Complete Board</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile accordion layout */}
      <div className="md:hidden">
        {/* Small Grid Preview */}
        <div className="mb-4 flex justify-center">
          <div className="inline-block rounded-lg border bg-muted/30 p-3">
            <div className="mb-2 text-center text-xs text-muted-foreground">
              {rows}×{columns} Board Preview
            </div>
            <div className="flex flex-col gap-1">
              {Array.from({ length: rows }).map((_, rowIndex) => (
                <div key={`preview-row-${rowIndex}`} className="flex gap-1">
                  {Array.from({ length: columns }).map((_, colIndex) => (
                    <div
                      key={`preview-cell-${rowIndex}-${colIndex}`}
                      className="h-6 w-6 rounded border bg-muted/20"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Accordion Sections */}
        <Accordion type="multiple" className="w-full">
          {/* Row Bonuses */}
          <AccordionItem value="rows">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded border-2 border-green-300 bg-green-100" />
                <span>Row Bonuses</span>
                {Object.values(rowBonuses).filter((v) => v > 0).length > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-green-600 text-xs text-white"
                  >
                    {Object.values(rowBonuses).filter((v) => v > 0).length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {Array.from({ length: rows }).map((_, rowIndex) => (
                  <div
                    key={`mobile-row-${rowIndex}`}
                    className="flex items-center gap-2"
                  >
                    <Label
                      htmlFor={`mobile-rowBonus-${rowIndex}`}
                      className="min-w-[60px] text-sm"
                    >
                      Row {rowIndex + 1}:
                    </Label>
                    <Input
                      id={`mobile-rowBonus-${rowIndex}`}
                      type="number"
                      min="0"
                      value={rowBonuses[rowIndex] ?? 0}
                      onChange={(e) =>
                        onRowBonusChange(
                          rowIndex,
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="h-10"
                      disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Column Bonuses */}
          <AccordionItem value="columns">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded border-2 border-blue-300 bg-blue-100" />
                <span>Column Bonuses</span>
                {Object.values(columnBonuses).filter((v) => v > 0).length >
                  0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-blue-600 text-xs text-white"
                  >
                    {Object.values(columnBonuses).filter((v) => v > 0).length}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="space-y-3 pt-2">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <div
                    key={`mobile-col-${colIndex}`}
                    className="flex items-center gap-2"
                  >
                    <Label
                      htmlFor={`mobile-columnBonus-${colIndex}`}
                      className="min-w-[60px] text-sm"
                    >
                      Col {colIndex + 1}:
                    </Label>
                    <Input
                      id={`mobile-columnBonus-${colIndex}`}
                      type="number"
                      min="0"
                      value={columnBonuses[colIndex] ?? 0}
                      onChange={(e) =>
                        onColumnBonusChange(
                          colIndex,
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="h-10"
                      disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>

          {/* Diagonal Bonuses (only for square boards) */}
          {isSquare && (
            <AccordionItem value="diagonals">
              <AccordionTrigger className="text-sm font-medium">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded border-2 border-purple-300 bg-purple-100" />
                  <span>Diagonal Bonuses</span>
                  {(mainDiagonalBonus > 0 || antiDiagonalBonus > 0) && (
                    <Badge
                      variant="secondary"
                      className="ml-2 bg-purple-600 text-xs text-white"
                    >
                      {
                        [mainDiagonalBonus, antiDiagonalBonus].filter(
                          (v) => v > 0
                        ).length
                      }
                    </Badge>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="mobile-mainDiagonalBonus"
                      className="min-w-[100px] text-sm"
                    >
                      Main (↘):
                    </Label>
                    <Input
                      id="mobile-mainDiagonalBonus"
                      type="number"
                      min="0"
                      value={mainDiagonalBonus}
                      onChange={(e) =>
                        onMainDiagonalChange(
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="h-10"
                      disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor="mobile-antiDiagonalBonus"
                      className="min-w-[100px] text-sm"
                    >
                      Anti (↗):
                    </Label>
                    <Input
                      id="mobile-antiDiagonalBonus"
                      type="number"
                      min="0"
                      value={antiDiagonalBonus}
                      onChange={(e) =>
                        onAntiDiagonalChange(
                          e.target.value === "" ? 0 : parseInt(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="h-10"
                      disabled={disabled}
                    />
                    <span className="text-sm text-muted-foreground">XP</span>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          )}

          {/* Complete Board Bonus */}
          <AccordionItem value="complete">
            <AccordionTrigger className="text-sm font-medium">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded border-2 border-amber-300 bg-amber-100" />
                <span>Complete Board Bonus</span>
                {completeBoardBonus > 0 && (
                  <Badge
                    variant="secondary"
                    className="ml-2 bg-amber-600 text-xs text-white"
                  >
                    {completeBoardBonus} XP
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <Label
                    htmlFor="mobile-completeBoardBonus"
                    className="min-w-[100px] text-sm"
                  >
                    Full Board:
                  </Label>
                  <Input
                    id="mobile-completeBoardBonus"
                    type="number"
                    min="0"
                    value={completeBoardBonus}
                    onChange={(e) =>
                      onCompleteBoardChange(
                        e.target.value === "" ? 0 : parseInt(e.target.value)
                      )
                    }
                    placeholder="0"
                    className="h-10"
                    disabled={disabled}
                  />
                  <span className="text-sm text-muted-foreground">XP</span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Awarded when all tiles are completed
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}
