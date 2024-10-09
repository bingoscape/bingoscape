import React, { forwardRef } from 'react'
import { BingoTile } from './bingo-tile'
import { type Tile, type EventRole } from '@/app/actions/events'

interface BingoGridLayoutProps {
  tiles: Tile[]
  columns: number
  rows: number
  userRole: EventRole
  currentTeamId: string | undefined
  onTileClick: (tile: Tile) => void
  isLocked: boolean
  highlightedTiles: number[]
}


export const BingoGridLayout = React.forwardRef<HTMLDivElement, BingoGridLayoutProps>(
  ({ tiles, columns, rows, userRole, currentTeamId, onTileClick, isLocked, highlightedTiles }, ref) => {
    return (
      <div
        ref={ref}
        className={`grid gap-4`}
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
