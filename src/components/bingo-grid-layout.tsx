import React from "react"
import { BingoTile } from "./bingo-tile"
import type { Tile, EventRole } from "@/app/actions/events"

interface BingoGridLayoutProps {
  tiles: Tile[]
  columns: number
  rows: number
  userRole: EventRole
  currentTeamId: string | undefined
  onTileClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  isLocked: boolean
  highlightedTiles: number[]
  loadingTileId?: string
}

export const BingoGridLayout = React.forwardRef<
  HTMLDivElement,
  BingoGridLayoutProps
>(
  (
    {
      tiles,
      columns,
      rows,
      userRole,
      currentTeamId,
      onTileClick,
      onTogglePlaceholder,
      isLocked,
      highlightedTiles,
      loadingTileId,
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className="grid w-full max-w-full gap-2 p-2 sm:gap-3 sm:p-3 md:gap-4 md:p-4"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
        role="grid"
        aria-label={`Bingo grid with ${columns} columns and ${rows} rows`}
      >
        {tiles.map((tile, index) => (
          <div
            key={tile.id}
            className={`relative ${highlightedTiles.includes(tile.index) ? "ring-2 ring-red-500" : ""}`}
            role="gridcell"
            aria-label={`Tile ${index + 1} of ${tiles.length}`}
          >
            <BingoTile
              tile={tile}
              onClick={() => onTileClick(tile)}
              onTogglePlaceholder={() => onTogglePlaceholder(tile)}
              userRole={userRole}
              currentTeamId={currentTeamId}
              isLocked={isLocked}
              isLoading={loadingTileId === tile.id}
            />
          </div>
        ))}
      </div>
    )
  }
)

BingoGridLayout.displayName = "BingoGridLayout"
