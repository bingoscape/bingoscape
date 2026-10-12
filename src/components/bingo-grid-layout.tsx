"use client"

import React, { memo, useCallback, useMemo, useState } from "react"
import { BingoTile } from "./bingo-tile"
import { FitBoard } from "@/components/event-workspace/fit-board"
import { moveGridFocusSkipping } from "@/lib/board-fit"
import { markForTile, type BattleshipMarkSets } from "@/lib/battleship-marks"
import type { EventRole } from "@/app/actions/events"
import type { Tile } from "@/types/model"

interface BingoGridLayoutProps {
  tiles: Tile[]
  columns: number
  rows: number
  userRole: EventRole
  currentTeamId: string | undefined
  onTileClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  /** True when the layout is locked, i.e. not in "Edit layout" mode. */
  isLocked: boolean
  highlightedTiles: number[]
  loadingTileId?: string
  selectedTileId?: string | null
  /** Tiles that do not match the active Board filter (shown faded). */
  dimmedTileIds?: ReadonlySet<string>
  /** Escape key inside the grid. */
  onClearSelection?: () => void
  readOnly?: boolean
  /**
   * Battleship: hits, misses and sunk ships of the viewed Team, precomputed by
   * the workspace. Absent on every other Board.
   */
  marks?: BattleshipMarkSets
}

/**
 * The Board as a fit-to-viewport grid.
 *
 * Accessibility: a single tab stop (roving tabindex). Arrow keys move by
 * row/column, Home/End jump within the row, Enter/Space select, Escape clears
 * the selection. Hidden Tiles are skipped for players. In layout edit mode the
 * Tiles must be direct children of the grid element (drag to swap), so the
 * ARIA row wrappers are only rendered while the layout is locked.
 */
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
        selectedTileId,
        dimmedTileIds,
        onClearSelection,
        readOnly = false,
        marks,
      },
      ref
    ) => {
      const isManagement = userRole === "admin" || userRole === "management"
      const editing = !isLocked

      const isSkippable = useCallback(
        (index: number) => {
          const tile = tiles[index]
          return !tile || (tile.isHidden && !isManagement)
        },
        [tiles, isManagement]
      )

      const selectedIndex = useMemo(
        () => tiles.findIndex((t) => t.id === selectedTileId),
        [tiles, selectedTileId]
      )

      const [focusIndex, setFocusIndex] = useState(0)

      const activeIndex = useMemo(() => {
        const preferred = focusIndex >= 0 ? focusIndex : 0
        if (!isSkippable(preferred) && tiles[preferred]) return preferred
        if (selectedIndex >= 0 && !isSkippable(selectedIndex))
          return selectedIndex
        const first = tiles.findIndex((_, i) => !isSkippable(i))
        return first >= 0 ? first : 0
      }, [focusIndex, isSkippable, selectedIndex, tiles])

      const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Escape") {
            onClearSelection?.()
            return
          }
          const target = (event.target as HTMLElement).closest<HTMLElement>(
            "[data-grid-index]"
          )
          if (!target) return
          const current = Number(target.dataset.gridIndex)
          if (Number.isNaN(current)) return

          const next = moveGridFocusSkipping(
            current,
            event.key,
            columns,
            tiles.length,
            isSkippable
          )
          if (
            ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(
              event.key
            )
          ) {
            event.preventDefault()
            if (next !== current) {
              setFocusIndex(next)
              const el = event.currentTarget.querySelector<HTMLElement>(
                `[data-grid-index="${next}"]`
              )
              el?.focus()
            }
          }
        },
        [columns, isSkippable, onClearSelection, tiles.length]
      )

      const handleFocus = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
        const target = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-grid-index]"
        )
        const index = target ? Number(target.dataset.gridIndex) : NaN
        if (!Number.isNaN(index)) setFocusIndex(index)
      }, [])

      const renderTile = (tile: Tile, index: number) => (
        <BingoTile
          key={tile.id}
          tile={tile}
          onClick={onTileClick}
          onTogglePlaceholder={onTogglePlaceholder}
          userRole={userRole}
          currentTeamId={currentTeamId}
          isLocked={isLocked}
          isLoading={loadingTileId === tile.id}
          selected={selectedTileId === tile.id}
          dimmed={dimmedTileIds?.has(tile.id) ?? false}
          tabIndex={index === activeIndex ? 0 : -1}
          row={Math.floor(index / columns) + 1}
          column={(index % columns) + 1}
          highlighted={highlightedTiles.includes(tile.index)}
          readOnly={readOnly}
          gridIndex={index}
          mark={markForTile(tile.id, marks)}
        />
      )

      const rowGroups = useMemo(() => {
        const groups: Array<Array<{ tile: Tile; index: number }>> = []
        tiles.forEach((tile, index) => {
          const r = Math.floor(index / columns)
          ;(groups[r] ??= []).push({ tile, index })
        })
        return groups
      }, [tiles, columns])

      return (
        <FitBoard
          ref={ref}
          key={editing ? "edit" : "view"}
          cols={columns}
          rows={rows}
          role={editing ? "group" : "grid"}
          aria-label={
            editing
              ? `Editing layout: ${rows} rows by ${columns} columns. Drag Tiles to swap them.`
              : `Bingo board, ${rows} rows by ${columns} columns`
          }
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
        >
          {editing
            ? tiles.map(renderTile)
            : rowGroups.map((group, r) => (
                <div key={r} role="row" className="contents">
                  {group.map(({ tile, index }) => renderTile(tile, index))}
                </div>
              ))}
        </FitBoard>
      )
    }
  )
)

BingoGridLayout.displayName = "BingoGridLayout"
