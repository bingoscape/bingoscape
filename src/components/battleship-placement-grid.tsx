"use client"

import { cn } from "@/lib/utils"
import type { ShipLengthColor } from "@/lib/ship-length-colors"
import type { Tile } from "@/app/actions/events"

interface BattleshipPlacementGridProps {
  tiles: Tile[]
  columns: number
  rows: number
  savedTileLengths: Map<string, number>
  currentShipTileIds: Set<string>
  currentShipLength: number | null
  lengthColors: Map<number, ShipLengthColor>
  onSelect: (tile: Tile) => void
  hideTileDetails?: boolean
  disabled?: boolean
}

export function BattleshipPlacementGrid({
  tiles,
  columns,
  savedTileLengths,
  currentShipTileIds,
  currentShipLength,
  lengthColors,
  onSelect,
  hideTileDetails = true,
  disabled = false,
}: BattleshipPlacementGridProps) {
  return (
    <div
      className="grid w-full max-w-full min-h-0 gap-1.5 sm:gap-2"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
      role="grid"
      aria-label="Ship placement grid"
    >
      {tiles.map((tile) => {
        const savedLength = savedTileLengths.get(tile.id)
        const isSaved = savedLength !== undefined
        const isCurrent = currentShipTileIds.has(tile.id)
        const length = isCurrent
          ? currentShipLength
          : isSaved
            ? savedLength
            : null
        const colors =
          length !== null && length !== undefined
            ? lengthColors.get(length)
            : undefined

        return (
          <button
            key={tile.id}
            type="button"
            disabled={disabled}
            onClick={() => onSelect(tile)}
            className={cn(
              "relative aspect-square min-h-0 w-full rounded-lg border-2 transition-colors",
              "active:scale-[0.98]",
              disabled && "cursor-not-allowed opacity-60 hover:scale-100",
              isSaved && !isCurrent && colors?.badge,
              isCurrent && cn(colors?.badge, colors?.badgeSelected),
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
