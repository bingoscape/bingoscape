"use client"

import React, { useCallback, useMemo, useState } from "react"
import { Lock, Unlock } from "lucide-react"
import { BingoTile } from "@/components/bingo-tile"
import { FitBoard } from "@/components/event-workspace/fit-board"
import { moveLadderFocus, tierLadderMetrics } from "@/lib/board-fit"
import {
  getTierEarnedXp,
  getTierStatus,
  getTierXpRequired,
  groupTilesByTier,
  type BoardTierData,
} from "@/lib/tiers"
import { cn } from "@/lib/utils"
import type { EventRole } from "@/app/actions/events"
import type { Tile } from "@/types/model"

interface TierLadderViewProps {
  tiles: Tile[]
  columns: number
  tierData: BoardTierData
  userRole: EventRole
  currentTeamId: string | undefined
  selectedTileId: string | null
  onSelectTile: (tileId: string | null) => void
}

/**
 * Read-only view of a progression Board: stacked tier bands, each with a thin
 * header ("Tier 2: 3/5 XP to unlock") and its Tiles wrapped at the column
 * count. It uses the same fit-to-viewport sizing as a plain Board (effective
 * rows = Tile rows + a fractional header row per tier). Locked Tiles are
 * dimmed with a lock glyph but can still be selected; the panel explains what
 * is missing. Layout editing uses ProgressionBingoGrid instead.
 */
export function TierLadderView({
  tiles,
  columns,
  tierData,
  userRole,
  currentTeamId,
  selectedTileId,
  onSelectTile,
}: TierLadderViewProps) {
  const isManagement = userRole === "admin" || userRole === "management"

  const bands = useMemo(() => groupTilesByTier(tiles), [tiles])
  const metrics = useMemo(
    () =>
      tierLadderMetrics(
        bands.map((b) => b.tiles.length),
        columns
      ),
    [bands, columns]
  )

  // Row/column per Tile in reading order, for keyboard navigation.
  const { flat, cells, rowTemplate } = useMemo(() => {
    const flatTiles: Tile[] = []
    const gridCells: Array<{ row: number; col: number }> = []
    const templateParts: string[] = []
    let visualRow = 0
    for (const band of bands) {
      templateParts.push("calc(var(--s) * 0.45)")
      const rowsInBand = Math.ceil(band.tiles.length / columns)
      if (rowsInBand > 0) templateParts.push(`repeat(${rowsInBand}, var(--s))`)
      band.tiles.forEach((tile, i) => {
        flatTiles.push(tile)
        gridCells.push({
          row: visualRow + Math.floor(i / columns),
          col: i % columns,
        })
      })
      visualRow += rowsInBand
    }
    return {
      flat: flatTiles,
      cells: gridCells,
      rowTemplate: templateParts.join(" "),
    }
  }, [bands, columns])

  const isSkippable = useCallback(
    (index: number) => {
      const tile = flat[index]
      return !tile || (tile.isHidden && !isManagement)
    },
    [flat, isManagement]
  )

  const [focusIndex, setFocusIndex] = useState(0)
  const selectedIndex = flat.findIndex((t) => t.id === selectedTileId)
  const activeIndex = !isSkippable(focusIndex)
    ? focusIndex
    : selectedIndex >= 0 && !isSkippable(selectedIndex)
      ? selectedIndex
      : Math.max(
          0,
          flat.findIndex((_, i) => !isSkippable(i))
        )

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        onSelectTile(null)
        return
      }
      const target = (event.target as HTMLElement).closest<HTMLElement>(
        "[data-grid-index]"
      )
      if (!target) return
      const current = Number(target.dataset.gridIndex)
      if (!["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
        return
      }
      event.preventDefault()
      const next = moveLadderFocus(cells, current, event.key, isSkippable)
      if (next !== current) {
        setFocusIndex(next)
        event.currentTarget
          .querySelector<HTMLElement>(`[data-grid-index="${next}"]`)
          ?.focus()
      }
    },
    [cells, isSkippable, onSelectTile]
  )

  const handleFocus = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    const target = (event.target as HTMLElement).closest<HTMLElement>(
      "[data-grid-index]"
    )
    const index = target ? Number(target.dataset.gridIndex) : NaN
    if (!Number.isNaN(index)) setFocusIndex(index)
  }, [])

  let running = 0

  return (
    <FitBoard
      cols={columns}
      rows={metrics.rows}
      vgaps={metrics.vgaps}
      role="grid"
      aria-label={`Tiered bingo board with ${bands.length} tiers`}
      style={{ gridTemplateRows: rowTemplate }}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
    >
      {bands.map((band) => {
        const status = getTierStatus(band.tier, tiles, currentTeamId, tierData)
        const earnedHere = getTierEarnedXp(tiles, currentTeamId, band.tier)
        const requiredHere = getTierXpRequired(tierData.requirements, band.tier)
        const nextTier = bands.find((b) => b.tier > band.tier)?.tier
        const startIndex = running
        running += band.tiles.length

        const rowGroups: Array<Array<{ tile: Tile; index: number }>> = []
        band.tiles.forEach((tile, i) => {
          const r = Math.floor(i / columns)
          ;(rowGroups[r] ??= []).push({ tile, index: startIndex + i })
        })

        return (
          <div key={band.tier} role="rowgroup" className="contents">
            <div role="row" className="contents">
              <div
                role="columnheader"
                aria-colspan={columns}
                style={{
                  gridColumn: "1 / -1",
                  fontSize: "clamp(10px, calc(var(--s) * 0.2), 14px)",
                }}
                className={cn(
                  "osrs-text-shadow flex min-w-0 items-center gap-1.5 overflow-hidden px-2 font-display whitespace-nowrap",
                  status.unlocked ? "text-osrs-gold" : "text-muted-foreground"
                )}
              >
                {status.unlocked ? (
                  <Unlock aria-hidden="true" className="size-[1em] shrink-0" />
                ) : (
                  <Lock aria-hidden="true" className="size-[1em] shrink-0" />
                )}
                <span className="truncate">
                  Tier {band.tier}
                  {band.tier > 0 && !status.unlocked && (
                    <>
                      {" "}
                      - {status.earnedInPrevious}/{status.requiredInPrevious} XP
                      in Tier {band.tier - 1} to unlock
                    </>
                  )}
                  {status.unlocked && nextTier !== undefined && (
                    <>
                      {" "}
                      - {Math.min(earnedHere, requiredHere)}/{requiredHere} XP
                      to unlock Tier {nextTier}
                    </>
                  )}
                </span>
              </div>
            </div>
            {rowGroups.map((group, r) => (
              <div key={r} role="row" className="contents">
                {group.map(({ tile, index }) => (
                  <BingoTile
                    key={tile.id}
                    tile={tile}
                    onClick={(t) => onSelectTile(t.id)}
                    onTogglePlaceholder={() => undefined}
                    userRole={userRole}
                    currentTeamId={currentTeamId}
                    isLocked
                    readOnly
                    selected={selectedTileId === tile.id}
                    tabIndex={index === activeIndex ? 0 : -1}
                    row={(cells[index]?.row ?? 0) + 1}
                    column={(cells[index]?.col ?? 0) + 1}
                    tierLocked={!status.unlocked}
                    gridIndex={index}
                  />
                ))}
              </div>
            ))}
          </div>
        )
      })}
    </FitBoard>
  )
}
