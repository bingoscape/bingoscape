"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { toast } from "@/hooks/use-toast"
import { updateTile } from "@/app/actions/bingo"
import "@/styles/modal-animations.css"
import type { Bingo, Tile } from "@/types/model"
import { type EventRole } from "@/app/actions/events"
import Sortable, { type SortableEvent } from "sortablejs"
import { BingoGridLayout } from "./bingo-grid-layout"
import { ProgressionBingoGrid } from "./progression-bingo-grid"
import type { BoardTierData } from "@/lib/tiers"
import type { BattleshipMarkSets } from "@/lib/battleship-marks"

interface BingoGridProps {
  bingo: Bingo
  userRole: EventRole
  currentTeamId: string | undefined
  /** Controls whether the board layout can be modified. */
  isLayoutLocked: boolean
  onReorderTiles?: (reorderedTiles: Tile[]) => void
  highlightedTiles: number[]
  onTileUpdated?: () => void
  selectedTileId: string | null
  /** Tiles that do not match the active Board filter (shown faded). */
  dimmedTileIds?: ReadonlySet<string>
  onSelectTile: (tileId: string | null) => void
  /** Tier unlock data (progression Boards, layout edit mode). */
  tierData?: BoardTierData | null
  /** Public view: no placeholder toggling. */
  readOnly?: boolean
  /** Battleship: the viewed Team's hits, misses and sunk ships. */
  marks?: BattleshipMarkSets
}

/**
 * The Board's tiles: selection, layout editing (drag to swap, reveal hidden
 * placeholders) and the progression edit view. Everything about the selected
 * Tile (details, Goals, Submissions) lives in event-workspace/tile-panel.tsx.
 */
export default function BingoGrid({
  bingo,
  userRole,
  currentTeamId,
  isLayoutLocked,
  onReorderTiles,
  highlightedTiles,
  onTileUpdated,
  selectedTileId,
  dimmedTileIds,
  onSelectTile,
  tierData,
  readOnly = false,
  marks,
}: BingoGridProps) {
  const [tiles, setTiles] = useState<Tile[]>(bingo.tiles ?? [])
  // Re-sync local tiles (needed for drag-to-swap) when fresh data arrives.
  const [syncedTiles, setSyncedTiles] = useState(bingo.tiles)
  if (bingo.tiles !== syncedTiles) {
    setSyncedTiles(bingo.tiles)
    setTiles(bingo.tiles ?? [])
  }

  const gridRef = useRef<HTMLDivElement>(null)
  const sortableRef = useRef<Sortable | null>(null)

  const hasSufficientRights = userRole === "admin" || userRole === "management"

  useEffect(() => {
    if (gridRef.current && hasSufficientRights && !isLayoutLocked) {
      sortableRef.current = new Sortable(gridRef.current, {
        animation: 150,
        swap: true,
        swapClass: "bh-yellow-100",
        ghostClass: "bg-pending/15",
        onEnd: (event: SortableEvent) => {
          const { oldIndex, newIndex } = event
          if (
            oldIndex === undefined ||
            newIndex === undefined ||
            oldIndex === newIndex
          ) {
            return
          }
          const updatedTiles = [...tiles]
          const [movedTile] = updatedTiles.splice(oldIndex, 1)
          if (!movedTile) return
          updatedTiles.splice(newIndex, 0, movedTile)

          // Update the indices of the swapped tiles
          const minIndex = Math.min(oldIndex, newIndex)
          const maxIndex = Math.max(oldIndex, newIndex)
          for (let i = minIndex; i <= maxIndex; i++) {
            const tile = updatedTiles[i]
            if (tile) updatedTiles[i] = { ...tile, index: i }
          }

          setTiles(updatedTiles)
          if (onReorderTiles) onReorderTiles(updatedTiles)
        },
      })

      return () => {
        if (sortableRef.current) {
          sortableRef.current.destroy()
          sortableRef.current = null
        }
      }
    }
  }, [tiles, isLayoutLocked, onReorderTiles, hasSufficientRights])

  const handleTogglePlaceholder = useCallback(
    async (tile: Tile) => {
      if (isLayoutLocked) {
        toast({
          title: "Layout locked",
          description: "The bingo board layout is currently locked for editing.",
          variant: "destructive",
        })
        return
      }

      const result = await updateTile(tile.id, { isHidden: !tile.isHidden })
      if (result.success) {
        setTiles((prevTiles) =>
          prevTiles.map((t) =>
            t.id === tile.id ? { ...t, isHidden: !tile.isHidden } : t
          )
        )
        onTileUpdated?.()
        toast({
          title: "Tile updated",
          description: `The tile is now ${!tile.isHidden ? "a placeholder" : "no longer a placeholder"}.`,
        })
      } else {
        toast({
          title: "Error",
          description: "Failed to update tile",
          variant: "destructive",
        })
      }
    },
    [isLayoutLocked, onTileUpdated]
  )

  const handleTileClick = useCallback(
    async (tile: Tile) => {
      // Blind Tiles have nothing to open.
      if (tile.isBlind) return
      if (tile.isHidden && !isLayoutLocked && hasSufficientRights) {
        await handleTogglePlaceholder(tile)
        return
      }
      onSelectTile(tile.id)
    },
    [isLayoutLocked, hasSufficientRights, handleTogglePlaceholder, onSelectTile]
  )

  if (bingo.bingoType === "progression") {
    return (
      <div className="min-h-0 overflow-auto">
        <ProgressionBingoGrid
          tiles={tiles}
          currentTeamId={currentTeamId}
          onTileClick={handleTileClick}
          tierProgress={(tierData?.progress ?? []).map((p) => ({
            tier: p.tier,
            isUnlocked: p.isUnlocked,
            unlockedAt: p.unlockedAt ?? null,
          }))}
          tierXpRequirements={tierData?.requirements ?? []}
          userRole={userRole}
          bingoId={bingo.id}
          onTilesUpdated={onTileUpdated}
          isEditMode={!isLayoutLocked}
        />
      </div>
    )
  }

  return (
    <BingoGridLayout
      ref={gridRef}
      tiles={tiles}
      columns={bingo.columns}
      rows={bingo.rows}
      userRole={userRole}
      currentTeamId={currentTeamId}
      onTileClick={handleTileClick}
      onTogglePlaceholder={handleTogglePlaceholder}
      highlightedTiles={highlightedTiles}
      isLocked={isLayoutLocked}
      selectedTileId={selectedTileId}
      dimmedTileIds={isLayoutLocked ? dimmedTileIds : undefined}
      onClearSelection={() => onSelectTile(null)}
      readOnly={readOnly}
      marks={marks}
    />
  )
}
