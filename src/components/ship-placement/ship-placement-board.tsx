"use client"

import { useCallback, useMemo, useState } from "react"
import type { KeyboardEvent } from "react"

import { FitBoard } from "@/components/event-workspace/fit-board"
import { moveGridFocusSkipping } from "@/lib/board-fit"
import type { PlacedShip } from "@/lib/ship-placement-state"
import { cn } from "@/lib/utils"

/** The part of a Tile the placement board needs. */
export interface PlacementTile {
  id: string
  index: number
  title: string
  isHidden: boolean
  isBlind: boolean
}

interface ShipPlacementBoardProps {
  tiles: PlacementTile[]
  rows: number
  columns: number
  ships: PlacedShip[]
  /** The ship being built tile by tile. */
  current: { length: number; tileIds: string[] } | null
  selectedShipId: string | null
  /** The cells show ships but do not react (event started). */
  locked: boolean
  onActivate: (tileId: string) => void
  /** Escape inside the board. */
  onEscape?: () => void
}

const ARROWS = [
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
]

/**
 * The Board as a placement grid. Cells are laid out by each Tile's `index`
 * (row = floor(index / columns)), so hidden Tiles keep their cell and nothing
 * shifts. Same structure as the main Board: one tab stop (roving tabindex),
 * arrows move, Enter/Space place, grid > row > gridcell.
 *
 * Ships are told apart from empty cells by shape, not by colour: every ship
 * uses the one `info` colour pair, each segment carries the ship length as a
 * numeral and neighbouring segments are joined by a bar. The ship that is
 * being built has a dashed border; a selected ship (or the one being built)
 * gets the yellow inset ring of a selected Tile.
 */
export function ShipPlacementBoard({
  tiles,
  rows,
  columns,
  ships,
  current,
  selectedShipId,
  locked,
  onActivate,
  onEscape,
}: ShipPlacementBoardProps) {
  const total = rows * columns

  const tileAt = useMemo(() => {
    const map = new Map<number, PlacementTile>()
    for (const tile of tiles) map.set(tile.index, tile)
    return map
  }, [tiles])

  /** tile id -> the ship (or the one being built) lying on it. */
  const shipByTile = useMemo(() => {
    const map = new Map<
      string,
      { key: string; length: number; building: boolean; selected: boolean }
    >()
    for (const ship of ships) {
      for (const id of ship.tileIds) {
        map.set(id, {
          key: ship.id,
          length: ship.length,
          building: false,
          selected: ship.id === selectedShipId,
        })
      }
    }
    if (current) {
      for (const id of current.tileIds) {
        map.set(id, {
          key: "current",
          length: current.length,
          building: true,
          selected: true,
        })
      }
    }
    return map
  }, [ships, current, selectedShipId])

  const isSkippable = useCallback(
    (index: number) => {
      const tile = tileAt.get(index)
      return !tile || tile.isHidden
    },
    [tileAt]
  )

  const [focusIndex, setFocusIndex] = useState(0)
  const activeIndex = useMemo(() => {
    if (!isSkippable(focusIndex)) return focusIndex
    for (let i = 0; i < total; i++) if (!isSkippable(i)) return i
    return 0
  }, [focusIndex, isSkippable, total])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      onEscape?.()
      return
    }
    if (!ARROWS.includes(event.key)) return
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-grid-index]"
    )
    const from = Number(target?.dataset.gridIndex)
    if (Number.isNaN(from)) return
    event.preventDefault()
    const next = moveGridFocusSkipping(
      from,
      event.key,
      columns,
      total,
      isSkippable
    )
    if (next === from) return
    setFocusIndex(next)
    event.currentTarget
      .querySelector<HTMLElement>(`[data-grid-index="${next}"]`)
      ?.focus()
  }

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-grid-index]"
    )
    const index = Number(target?.dataset.gridIndex)
    if (!Number.isNaN(index)) setFocusIndex(index)
  }

  const neighbourInSameShip = (tile: PlacementTile, otherIndex: number) => {
    const mine = shipByTile.get(tile.id)
    const other = tileAt.get(otherIndex)
    if (!mine || !other) return false
    return shipByTile.get(other.id)?.key === mine.key
  }

  const renderCell = (index: number) => {
    const tile = tileAt.get(index)
    const row = Math.floor(index / columns)
    const col = index % columns
    const position = `Row ${row + 1}, column ${col + 1}`

    if (!tile) {
      return (
        <div
          key={`empty-${index}`}
          aria-hidden="true"
          data-grid-index={index}
        />
      )
    }

    if (tile.isHidden) {
      return (
        <div
          key={tile.id}
          role="gridcell"
          aria-disabled="true"
          aria-label={`${position}, hidden tile, cannot hold a ship`}
          data-grid-index={index}
          className="osrs-tile border-muted-foreground/50 bg-field text-muted-foreground flex h-full w-full items-center justify-center rounded-sm border-2 border-dashed"
        >
          <span
            aria-hidden="true"
            className="osrs-tile-text @max-[43px]/tile:hidden"
          >
            Hidden
          </span>
        </div>
      )
    }

    const ship = shipByTile.get(tile.id)
    const state = ship
      ? `ship of length ${ship.length}${ship.building ? ", being placed" : ""}${ship.selected && !ship.building ? ", selected" : ""}`
      : "empty"
    const joinsRight = col + 1 < columns && neighbourInSameShip(tile, index + 1)
    const joinsBelow =
      row + 1 < rows && neighbourInSameShip(tile, index + columns)

    return (
      <div
        key={tile.id}
        role="gridcell"
        aria-label={`${position}, ${tile.title}, ${state}`}
        aria-selected={ship?.selected ?? false}
        aria-disabled={locked || undefined}
        tabIndex={index === activeIndex ? 0 : -1}
        data-grid-index={index}
        data-ship={ship ? ship.length : undefined}
        onClick={() => {
          if (!locked) onActivate(tile.id)
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            if (!locked) onActivate(tile.id)
          }
        }}
        className={cn(
          "osrs-tile osrs-slot relative h-full w-full touch-manipulation rounded-sm border-[3px]",
          "focus-visible:outline-ring focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-solid",
          locked ? "cursor-default" : "cursor-pointer hover:brightness-110",
          ship &&
            "border-info bg-info text-info-foreground hover:brightness-110",
          ship?.building && "border-dashed",
          ship?.selected && "ring-osrs-yellow z-10 ring-2 ring-inset"
        )}
      >
        {ship ? (
          <>
            <span
              aria-hidden="true"
              className="font-display absolute inset-0 flex items-center justify-center text-[clamp(12px,38cqw,28px)] leading-none"
            >
              {ship.length}
            </span>
            {joinsRight && (
              <span
                aria-hidden="true"
                className="bg-info absolute top-1/2 left-full h-[34%] w-[calc(var(--g)+6px)] -translate-y-1/2"
              />
            )}
            {joinsBelow && (
              <span
                aria-hidden="true"
                className="bg-info absolute top-full left-1/2 h-[calc(var(--g)+6px)] w-[34%] -translate-x-1/2"
              />
            )}
          </>
        ) : (
          <span
            aria-hidden="true"
            className="font-display text-muted-foreground osrs-tile-text absolute top-[5%] left-[6%] @max-[43px]/tile:hidden"
          >
            {index + 1}
          </span>
        )}
      </div>
    )
  }

  return (
    <FitBoard
      cols={columns}
      rows={rows}
      role="grid"
      aria-label={`Ship placement board, ${rows} rows by ${columns} columns`}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} role="row" className="contents">
          {Array.from({ length: columns }, (_, c) =>
            renderCell(r * columns + c)
          )}
        </div>
      ))}
    </FitBoard>
  )
}
