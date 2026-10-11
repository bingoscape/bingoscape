"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import { cn } from "@/lib/utils"
import type { ExportedBingo } from "@/app/actions/bingo-import-export"
import { Zap } from "lucide-react"
import getRandomFrog from "@/lib/getRandomFrog"

interface TemplatePreviewWithTooltipProps {
  templateData: string | null
  title: string
  className?: string
  isDetailView?: boolean
  initialSelectedIndex?: number
}

function parseTemplate(
  templateData: string | null
): { data: ExportedBingo | null; error: boolean } {
  if (!templateData) return { data: null, error: false }
  try {
    return { data: JSON.parse(templateData) as ExportedBingo, error: false }
  } catch (err) {
    console.error("Error parsing template data:", err)
    return { data: null, error: true }
  }
}

/**
 * Tap-a-tile board preview. The selected Tile's details render in a panel
 * below the board (not a hover card), so it works on touch and never covers
 * the board.
 */
export default function TemplatePreviewWithTooltip({
  templateData,
  title,
  className,
  isDetailView = false,
  initialSelectedIndex = 0,
}: TemplatePreviewWithTooltipProps) {
  const { data: parsedData, error } = useMemo(
    () => parseTemplate(templateData),
    [templateData]
  )
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex)

  if (error || !parsedData) {
    return (
      <div
        className={cn(
          "relative flex items-center justify-center overflow-hidden rounded-md bg-muted p-6",
          className
        )}
      >
        <p className="text-muted-foreground">
          {error ? "Error loading template preview" : "No preview available"}
        </p>
      </div>
    )
  }

  const { metadata, tiles } = parsedData
  const { rows, columns } = metadata

  // For list view, limit the grid size to make it more compact
  const displayRows = isDetailView ? rows : Math.min(rows, 5)
  const displayColumns = isDetailView ? columns : Math.min(columns, 5)
  const displayTiles = isDetailView
    ? tiles
    : tiles.slice(0, displayRows * displayColumns)
  const selectedTile = displayTiles[selectedIndex]

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="group"
        aria-label={`${title}: tap a Tile to see its details`}
        className={cn(
          "mx-auto grid aspect-square w-full gap-1 p-2",
          isDetailView && "max-w-[80vh]"
        )}
        style={{
          gridTemplateColumns: `repeat(${displayColumns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${displayRows}, minmax(0, 1fr))`,
        }}
      >
        {displayTiles.map((tile, index) => (
          <button
            key={index}
            type="button"
            aria-pressed={index === selectedIndex}
            aria-label={tile.title}
            onClick={() => setSelectedIndex(index)}
            className={cn(
              "relative aspect-square overflow-hidden rounded border p-2 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring sm:p-4",
              index === selectedIndex
                ? "border-osrs-yellow ring-2 ring-osrs-yellow"
                : "border-primary hover:scale-105 hover:shadow-md"
            )}
          >
            {tile.headerImage ? (
              <Image
                src={tile.headerImage || getRandomFrog()}
                alt=""
                fill
                className="object-scale-down"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-primary px-1 text-xs font-semibold text-primary-foreground">
                <span className="truncate">{tile.title}</span>
              </span>
            )}
          </button>
        ))}
      </div>

      {selectedTile && (
        <div
          aria-live="polite"
          className="osrs-panel-inset space-y-2 rounded-sm p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-semibold">{selectedTile.title}</h4>
            <div className="flex shrink-0 items-center gap-1 rounded-sm bg-warning/30 px-2 py-1">
              <Zap aria-hidden="true" className="h-3.5 w-3.5 text-warning" />
              <span className="text-xs font-medium">
                {selectedTile.weight} XP
              </span>
            </div>
          </div>

          {selectedTile.description && (
            <p className="line-clamp-3 text-sm text-muted-foreground">
              {selectedTile.description}
            </p>
          )}

          {selectedTile.goals && selectedTile.goals.length > 0 && (
            <div className="pt-1">
              <h5 className="mb-1 text-xs font-semibold">Goals:</h5>
              <ul className="space-y-1 text-xs">
                {selectedTile.goals.map((goal, idx) => (
                  <li key={idx} className="flex justify-between gap-3">
                    <span className="text-muted-foreground">
                      {goal.description}
                    </span>
                    <span className="shrink-0 font-medium">
                      Target: {goal.targetValue}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedTile.isHidden && (
            <div className="rounded-sm bg-muted p-1.5 text-xs">
              <span className="font-medium">Hidden tile</span> - Not visible on
              the board until revealed
            </div>
          )}
        </div>
      )}

      {!isDetailView && (rows > displayRows || columns > displayColumns) && (
        <p className="text-right text-xs text-muted-foreground">
          {rows}×{columns} grid
        </p>
      )}
    </div>
  )
}
