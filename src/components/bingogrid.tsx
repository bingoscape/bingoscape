"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { toast } from "@/hooks/use-toast"
import {
  updateTile,
  getTileGoalsAndProgress,
  getTierXpRequirements,
  getTeamTierProgress,
  initializeTeamTierProgress,
} from "@/app/actions/bingo"
import { getSubmissions } from "@/app/actions/getSubmissions"
import type { Bingo, Tile, Team, EventRole } from "@/app/actions/events"
import Sortable, { type SortableEvent } from "sortablejs"
import { BingoGridLayout } from "./bingo-grid-layout"
import { ProgressionBingoGrid } from "./progression-bingo-grid"
import { TileEditor } from "./tile-editor"
import { StatsDialog } from "./stats-dialog"
import { BarChart } from "lucide-react"
import { Button } from "@/components/ui/button"

// Pure utility — no component closure needed
function hasSufficientRights(userRole: EventRole): boolean {
  return userRole === "admin" || userRole === "management"
}

interface BingoGridProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
  gameType: "osrs" | "rs3"
  isLayoutLocked: boolean // Controls whether the board layout can be modified
  onReorderTiles?: (reorderedTiles: Tile[]) => void
  highlightedTiles: number[]
  /**
   * Controlled mode: when provided alongside `onTileDeleted`, BingoGrid reads
   * tiles from `bingo.tiles` and never maintains its own tile state.
   * Uncontrolled mode: when absent, BingoGrid manages tiles locally (default,
   * used by direct callers such as event-bingos-client.tsx).
   */
  onTileUpdated?: (tile: Tile) => void
  onTileDeleted?: (tileId: string) => void
}

export default function BingoGrid({
  bingo,
  userRole,
  teams,
  currentTeamId,
  gameType,
  isLayoutLocked,
  onReorderTiles,
  highlightedTiles,
  onTileUpdated,
  onTileDeleted,
}: BingoGridProps) {
  // Controlled when the parent owns tile state; uncontrolled otherwise.
  const isControlled = onTileUpdated !== undefined && onTileDeleted !== undefined
  const [localTiles, setLocalTiles] = useState<Tile[]>(bingo.tiles ?? [])

  // In controlled mode, tiles come straight from the prop.
  const tiles = useMemo(
    () => (isControlled ? (bingo.tiles ?? []) : localTiles),
    [isControlled, bingo.tiles, localTiles]
  )

  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const gridRef = useRef<HTMLDivElement>(null)
  const sortableRef = useRef<Sortable | null>(null)
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false)

  // Progression bingo state
  const [tierProgress, setTierProgress] = useState<
    Array<{
      tier: number
      isUnlocked: boolean
      unlockedAt: Date | null
    }>
  >([])
  const [tierXpRequirements, setTierXpRequirements] = useState<
    Array<{
      tier: number
      xpRequired: number
    }>
  >([])
  const [unlockedTiers, setUnlockedTiers] = useState<Set<number>>(new Set([0]))

  // Load tier progress for progression bingo
  useEffect(() => {
    const loadTierProgress = async () => {
      if (bingo.bingoType === "progression") {
        try {
          const xpRequirements = await getTierXpRequirements(bingo.id)
          setTierXpRequirements(
            xpRequirements.map((req) => ({
              tier: req.tier,
              xpRequired: req.xpRequired,
            }))
          )

          if (currentTeamId) {
            await initializeTeamTierProgress(currentTeamId, bingo.id)

            const progress = await getTeamTierProgress(currentTeamId, bingo.id)
            setTierProgress(
              progress.map((p) => ({
                tier: p.tier,
                isUnlocked: p.isUnlocked,
                unlockedAt: p.unlockedAt,
              }))
            )

            const unlockedTierSet = new Set(
              progress.filter((p) => p.isUnlocked).map((p) => p.tier)
            )
            setUnlockedTiers(unlockedTierSet)
          }
        } catch (error) {
          console.error("Error loading tier progress:", error)
        }
      }
    }

    loadTierProgress()
  }, [bingo.id, bingo.bingoType, currentTeamId])

  useEffect(() => {
    if (gridRef.current && hasSufficientRights(userRole) && !isLayoutLocked) {
      sortableRef.current = new Sortable(gridRef.current, {
        animation: 150,
        swap: true,
        swapClass: "bh-yellow-100",
        ghostClass: "bg-blue-100",
        onEnd: (event: SortableEvent) => {
          const { oldIndex, newIndex } = event
          if (oldIndex !== newIndex) {
            const updatedTiles = [...tiles]
            const [movedTile] = updatedTiles.splice(oldIndex!, 1)
            updatedTiles.splice(newIndex!, 0, movedTile!)

            const minIndex = Math.min(oldIndex!, newIndex!)
            const maxIndex = Math.max(oldIndex!, newIndex!)
            for (let i = minIndex; i <= maxIndex; i++) {
              updatedTiles[i] = { ...updatedTiles[i], index: i } as Tile
            }

            if (!isControlled) setLocalTiles(updatedTiles)
            if (onReorderTiles) onReorderTiles(updatedTiles)

            toast({
              title: "Tiles swapped",
              description: "The tiles have been successfully swapped.",
            })
          }
        },
      })

      return () => {
        if (sortableRef.current) {
          sortableRef.current.destroy()
          sortableRef.current = null
        }
      }
    }
  }, [tiles, isLayoutLocked, onReorderTiles, userRole, isControlled])

  const handleTileClick = async (tile: Tile) => {
    if (
      bingo.bingoType === "progression" &&
      !unlockedTiers.has(tile.tier) &&
      isLayoutLocked &&
      !hasSufficientRights(userRole)
    ) {
      toast({
        title: "Tier locked",
        description: `Complete more tiles in tier ${tile.tier} to unlock this tier`,
        variant: "destructive",
      })
      return
    }

    if (tile.isHidden && !isLayoutLocked && hasSufficientRights(userRole)) {
      await handleTogglePlaceholder(tile)
      return
    }

    try {
      const goals = await getTileGoalsAndProgress(tile.id)
      const teamTileSubmissions = await getSubmissions(tile.id)
      const updatedTile: Tile = { ...tile, goals, teamTileSubmissions }
      setSelectedTile(updatedTile)
      setIsEditorOpen(true)
    } catch (error) {
      console.error("Error fetching tile data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch tile data",
        variant: "destructive",
      })
    }
  }

  const handleTogglePlaceholder = async (tile: Tile) => {
    if (isLayoutLocked) {
      toast({
        title: "Layout locked",
        description: "The bingo board layout is currently locked for editing.",
        variant: "destructive",
      })
      return
    }

    const updatedTile = { ...tile, isHidden: !tile.isHidden }
    const result = await updateTile(tile.id, updatedTile)
    if (result.success) {
      if (isControlled) {
        onTileUpdated!(updatedTile)
      } else {
        setLocalTiles((prevTiles) =>
          prevTiles.map((t) => (t.id === tile.id ? updatedTile : t))
        )
      }
      toast({
        title: "Tile updated",
        description: `The tile is now ${updatedTile.isHidden ? "a placeholder" : "no longer a placeholder"}.`,
      })
    } else {
      toast({
        title: "Error",
        description: "Failed to update tile",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="mb-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-2"
          onClick={() => setIsStatsDialogOpen(true)}
        >
          <BarChart className="h-4 w-4" />
          Stats
        </Button>
      </div>
      {bingo.bingoType === "progression" ? (
        <ProgressionBingoGrid
          tiles={tiles}
          currentTeamId={currentTeamId}
          onTileClick={handleTileClick}
          tierProgress={tierProgress}
          tierXpRequirements={tierXpRequirements}
          userRole={userRole}
          bingoId={bingo.id}
          onTilesUpdated={undefined}
          isEditMode={!isLayoutLocked}
        />
      ) : (
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
        />
      )}

      {selectedTile && isEditorOpen && (
        <TileEditor
          tile={selectedTile}
          bingo={bingo}
          userRole={userRole}
          teams={teams}
          gameType={gameType}
          currentTeamId={currentTeamId}
          isLayoutLocked={isLayoutLocked}
          onClose={() => setIsEditorOpen(false)}
          onTileUpdated={undefined}
          onTileChanged={(tileId, patch) => {
            if (isControlled) {
              const currentTile = tiles.find((t) => t.id === tileId)
              if (currentTile) {
                onTileUpdated!({ ...currentTile, ...patch } as Tile)
              }
            } else {
              setLocalTiles((prev) =>
                prev.map((t) => (t.id === tileId ? { ...t, ...patch } : t))
              )
            }
          }}
          onTileDeleted={(tileId) => {
            if (isControlled) {
              onTileDeleted!(tileId)
            } else {
              setLocalTiles((prev) => prev.filter((t) => t.id !== tileId))
            }
          }}
        />
      )}

      <StatsDialog
        isOpen={isStatsDialogOpen}
        onOpenChange={setIsStatsDialogOpen}
        userRole={userRole}
        currentTeamId={currentTeamId}
        teams={teams}
        bingoId={bingo.id}
      />
    </div>
  )
}
