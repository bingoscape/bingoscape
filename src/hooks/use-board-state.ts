"use client"

import { useState, useCallback, useEffect } from "react"
import { toast } from "@/hooks/use-toast"
import {
  addRowOrColumn,
  deleteRowOrColumn,
  reorderTiles,
  toggleBingoLock,
} from "@/app/actions/bingo"
import type { Bingo, Tile } from "@/app/actions/events"

export interface BoardStateActions {
  bingo: Bingo
  isLayoutLocked: boolean
  highlightedTiles: number[]
  handleToggleLock: () => Promise<void>
  handleAddRow: () => Promise<void>
  handleAddColumn: () => Promise<void>
  handleDeleteRow: () => Promise<void>
  handleDeleteColumn: () => Promise<void>
  handleReorderTiles: (reorderedTiles: Tile[]) => Promise<void>
  updateTileLocally: (updated: Tile) => void
  removeTile: (tileId: string) => void
  highlightTilesToDelete: (type: "row" | "column") => void
  clearHighlightedTiles: () => void
}

export function useBoardState(initialBingo: Bingo): BoardStateActions {
  const [bingo, setBingo] = useState<Bingo>(initialBingo)
  const [highlightedTiles, setHighlightedTiles] = useState<number[]>([])

  // Sync when server data refreshes (router.refresh() bumps updatedAt)
  useEffect(() => {
    setBingo(initialBingo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialBingo.updatedAt?.toString()])

  // Derived from persisted DB value
  const isLayoutLocked = bingo.locked

  // ── Lock toggle ────────────────────────────────────────────────────────────

  const handleToggleLock = useCallback(async () => {
    const nextLocked = !bingo.locked
    // Optimistic update
    setBingo((prev) => ({ ...prev, locked: nextLocked }))
    const result = await toggleBingoLock(bingo.id, nextLocked)
    if (result.success) {
      toast({
        title: nextLocked ? "Bingo board locked" : "Bingo board unlocked",
        description: nextLocked
          ? "The bingo board is now locked."
          : "You can now edit the bingo board.",
      })
    } else {
      // Rollback on failure
      setBingo((prev) => ({ ...prev, locked: !nextLocked }))
      toast({
        title: "Error",
        description: "Failed to update lock state",
        variant: "destructive",
      })
    }
  }, [bingo.id, bingo.locked])

  // ── Board-structure helpers ────────────────────────────────────────────────

  const applyStructuralResult = useCallback(
    (result: { success: true; tiles: Tile[]; bingo: Bingo } | { success: false; error: string }) => {
      if (result.success) {
        setBingo((prev) => ({
          ...prev,
          rows: result.bingo.rows,
          columns: result.bingo.columns,
          tiles: result.tiles,
        }))
        return true
      }
      return false
    },
    []
  )

  const handleAddRow = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, "row")
      if (applyStructuralResult(result)) {
        toast({ title: "Row added", description: "A new row has been added to the bingo board." })
      } else if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding row:", error)
      toast({ title: "Error", description: "Failed to add row", variant: "destructive" })
    }
  }, [bingo.id, applyStructuralResult])

  const handleAddColumn = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, "column")
      if (applyStructuralResult(result)) {
        toast({ title: "Column added", description: "A new column has been added to the bingo board." })
      } else if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding column:", error)
      toast({ title: "Error", description: "Failed to add column", variant: "destructive" })
    }
  }, [bingo.id, applyStructuralResult])

  const handleDeleteRow = useCallback(async () => {
    try {
      const result = await deleteRowOrColumn(bingo.id, "row")
      if (applyStructuralResult(result)) {
        toast({ title: "Row deleted", description: "The last row has been deleted from the bingo board." })
      } else if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting row:", error)
      toast({ title: "Error", description: "Failed to delete row", variant: "destructive" })
    }
  }, [bingo.id, applyStructuralResult])

  const handleDeleteColumn = useCallback(async () => {
    try {
      const result = await deleteRowOrColumn(bingo.id, "column")
      if (applyStructuralResult(result)) {
        toast({ title: "Column deleted", description: "The last column has been deleted from the bingo board." })
      } else if (!result.success) {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting column:", error)
      toast({ title: "Error", description: "Failed to delete column", variant: "destructive" })
    }
  }, [bingo.id, applyStructuralResult])

  const handleReorderTiles = useCallback(
    async (reorderedTiles: Tile[]) => {
      const updatedTiles = reorderedTiles.map((tile, index) => ({ id: tile.id, index }))
      const result = await reorderTiles(updatedTiles)
      if (result.success) {
        setBingo((prev) => ({ ...prev, tiles: reorderedTiles }))
        toast({ title: "Tiles reordered", description: "The tiles have been successfully reordered and saved." })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to reorder tiles",
          variant: "destructive",
        })
      }
    },
    []
  )

  // ── Tile-level mutations ───────────────────────────────────────────────────

  const updateTileLocally = useCallback((updated: Tile) => {
    setBingo((prev) => ({
      ...prev,
      tiles: (prev.tiles ?? []).map((t) => (t.id === updated.id ? updated : t)),
    }))
  }, [])

  const removeTile = useCallback((tileId: string) => {
    setBingo((prev) => ({
      ...prev,
      tiles: (prev.tiles ?? []).filter((t) => t.id !== tileId),
    }))
  }, [])

  // ── Highlight helpers ──────────────────────────────────────────────────────

  const highlightTilesToDelete = useCallback(
    (type: "row" | "column") => {
      const allTiles = bingo.tiles ?? []
      const tilesToHighlight =
        type === "row"
          ? allTiles.slice(-bingo.columns)
          : allTiles.filter((_, index) => (index + 1) % bingo.columns === 0)
      setHighlightedTiles(tilesToHighlight.map((tile) => tile.index))
    },
    [bingo.tiles, bingo.columns]
  )

  const clearHighlightedTiles = useCallback(() => {
    setHighlightedTiles([])
  }, [])

  return {
    bingo,
    isLayoutLocked,
    highlightedTiles,
    handleToggleLock,
    handleAddRow,
    handleAddColumn,
    handleDeleteRow,
    handleDeleteColumn,
    handleReorderTiles,
    updateTileLocally,
    removeTile,
    highlightTilesToDelete,
    clearHighlightedTiles,
  }
}
