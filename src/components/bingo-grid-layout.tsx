import React, { memo } from "react"
import { BingoTile } from "./bingo-tile"
import { EventRole } from "@/app/actions/events"
import type { Tile } from "@/types/model"

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
  hitByCurrentTeamTileIds?: Set<string>
  sunkByCurrentTeamTileIds?: Set<string>
  missByCurrentTeamTileIds?: Set<string>
  hideTileDetails?: boolean
}

export const BingoGridLayout = memo(
  React.forwardRef<HTMLDivElement, BingoGridLayoutProps>(
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
        hitByCurrentTeamTileIds,
        sunkByCurrentTeamTileIds,
        missByCurrentTeamTileIds,
        hideTileDetails,
      },
      ref
    ) => {
      return (
        <div
          ref={ref}
          className="grid w-full max-w-full min-h-0 gap-1.5 p-2 sm:gap-2 sm:p-3 md:gap-2.5"
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
              className={`relative aspect-square min-h-0 min-w-0 overflow-hidden ${highlightedTiles.includes(tile.index) ? "ring-2 ring-red-500" : ""}`}
              role="gridcell"
              aria-posinset={index + 1}
              aria-setsize={tiles.length}
            >
              <BingoTile
                tile={tile}
                onClick={onTileClick}
                onTogglePlaceholder={onTogglePlaceholder}
                userRole={userRole}
                currentTeamId={currentTeamId}
                isLocked={isLocked}
                isLoading={loadingTileId === tile.id}
                isHitByCurrentTeam={hitByCurrentTeamTileIds?.has(tile.id)}
                isSunkHitByCurrentTeam={sunkByCurrentTeamTileIds?.has(tile.id)}
                isMissByCurrentTeam={
                  missByCurrentTeamTileIds?.has(tile.id) ?? false
                }
                hideTileDetails={hideTileDetails}
                tileLabel={hideTileDetails ? String(tile.index + 1) : undefined}
              />
            </div>
          ))}
        </div>
      )
    }
  )
)

BingoGridLayout.displayName = "BingoGridLayout"
