"use client"

import { cn } from "@/lib/utils"
import type { Tile } from "@/app/actions/events"

interface BattleshipPlacementGridProps {
  tiles: Tile[]
  columns: number
  rows: number
  savedShipTileIds: Set<string>
  currentShipTileIds: Set<string>
  onSelect: (tile: Tile) => void
  hideTileDetails?: boolean
  disabled?: boolean
}

export function BattleshipPlacementGrid({
  tiles,
  columns,
  rows,
  savedShipTileIds,
  currentShipTileIds,
  onSelect,
  hideTileDetails = true,
  disabled = false,
}: BattleshipPlacementGridProps) {
  return (
    <div
      className="grid gap-2 sm:gap-3 w-full max-w-full"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label="Ship placement grid"
    >
      {tiles.map((tile) => {
        const isSaved = savedShipTileIds.has(tile.id)
        const isCurrent = currentShipTileIds.has(tile.id)

        return (
          <button
            key={tile.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tile)}
            className={cn(
              "relative aspect-square rounded-lg border-2 transition-all min-h-[48px] sm:min-h-[64px]",
              "hover:scale-[1.02] active:scale-[0.98]",
              disabled && "cursor-not-allowed opacity-60 hover:scale-100",
              isSaved &&
                "border-blue-600 bg-blue-100 dark:bg-blue-900/40 ring-2 ring-blue-400",
              isCurrent &&
                "border-amber-500 bg-amber-100 dark:bg-amber-900/40 ring-2 ring-amber-400",
              !isSaved &&
                !isCurrent &&
                "border-muted-foreground/30 bg-muted/30 hover:border-primary"
            )}
          >
            {!hideTileDetails && !tile.isHidden && tile.headerImage && (
              <span className="sr-only">{tile.title}</span>
            )}
            {(isSaved || isCurrent) && (
              <span className="absolute inset-0 flex items-center justify-center text-lg">
                🚢
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
