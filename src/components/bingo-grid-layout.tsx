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
}

export const BingoGridLayout = forwardRef<HTMLDivElement, BingoGridLayoutProps>(
  ({ tiles, columns, rows, userRole, currentTeamId, onTileClick, isLocked }, ref) => {
    return (
      <div
        ref={ref}
        className={`grid gap-2 w-full h-full ${isLocked ? '' : 'cursor-move'}`}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
          aspectRatio: `${columns} / ${rows}`
        }}
      >
        {tiles.map((tile) => (
          <BingoTile
            key={tile.id}
            tile={tile}
            onClick={() => onTileClick(tile)}
            userRole={userRole}
            currentTeamId={currentTeamId}
          />
        ))}
      </div>
    )
  }
)

BingoGridLayout.displayName = 'BingoGridLayout'
