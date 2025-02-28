import React from 'react'
import { BingoTile } from './bingo-tile'
import type { Tile, EventRole } from '@/app/actions/events'

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
}

export const BingoGridLayout = React.forwardRef<HTMLDivElement, BingoGridLayoutProps>(
  ({ tiles, columns, rows, userRole, currentTeamId, onTileClick, onTogglePlaceholder, isLocked, highlightedTiles }, ref) => {
    return (
      <div
        ref={ref}
        className={`grid gap-2`}
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
        }}
      >
        {tiles.map((tile) => (
          <div

            key={tile.id}
            className={`relative ${highlightedTiles.includes(tile.index) ? 'ring-2 ring-red-500' : ''}`}
          >
            <BingoTile
              tile={tile}
              onClick={() => onTileClick(tile)}
              onTogglePlaceholder={() => onTogglePlaceholder(tile)}
              userRole={userRole}
              currentTeamId={currentTeamId}
              isLocked={isLocked}
            />
          </div>
        ))}
      </div>
    )
  }
)

BingoGridLayout.displayName = 'BingoGridLayout'
