"use client"

import { useState, useCallback, useEffect } from "react"
import BingoGrid from "@/components/bingogrid"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, PlusSquare, MinusSquare } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  addRowOrColumn,
  reorderTiles,
  deleteRowOrColumn,
} from "@/app/actions/bingo"
import type { Bingo, Tile, Team, EventRole } from "@/app/actions/events"
import { motion, AnimatePresence } from "framer-motion"
import { useSearchParams } from "next/navigation"

interface BingoGridWrapperProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
}

export default function BingoGridWrapper({
  bingo: initialBingo,
  userRole,
  teams,
  currentTeamId,
}: BingoGridWrapperProps) {
  const [bingo, setBingo] = useState(initialBingo)
  const [isLayoutLocked, setIsLocked] = useState(true)
  const [updateKey, setUpdateKey] = useState(0)
  const [highlightedTiles, setHighlightedTiles] = useState<number[]>([])
  const searchParams = useSearchParams()

  // Get the selected team ID from URL params or use the current team ID
  const selectedTeamId = searchParams?.get("teamId") ?? currentTeamId

  useEffect(() => {
    setUpdateKey((prev) => prev + 1)
  }, [bingo])

  const handleToggleLock = useCallback(async () => {
    // TODO: Implement the actual API call to toggle the lock state
    setIsLocked((prevIsLocked) => !prevIsLocked)
    setBingo((prevBingo) => ({ ...prevBingo, locked: !prevBingo.locked }))
    toast({
      title: isLayoutLocked ? "Bingo board unlocked" : "Bingo board locked",
      description: isLayoutLocked
        ? "You can now edit the bingo board."
        : "The bingo board is now locked.",
    })
  }, [isLayoutLocked])

  const updateBingoState = useCallback(
    (newTiles: Tile[], updatedBingo: Bingo) => {
      setBingo((prevBingo) => ({
        ...prevBingo,
        rows: updatedBingo.rows,
        columns: updatedBingo.columns,
        tiles: newTiles,
      }))
    },
    []
  )

  const handleAddRow = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, "row")
      if (result.success) {
        updateBingoState(result.tiles, result.bingo)
        toast({
          title: "Row added",
          description: "A new row has been added to the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding row:", error)
      toast({
        title: "Error",
        description: "Failed to add row",
        variant: "destructive",
      })
    }
  }, [bingo.id, updateBingoState])

  const handleAddColumn = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, "column")
      if (result.success) {
        updateBingoState(result.tiles, result.bingo)
        toast({
          title: "Column added",
          description: "A new column has been added to the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding column:", error)
      toast({
        title: "Error",
        description: "Failed to add column",
        variant: "destructive",
      })
    }
  }, [bingo.id, updateBingoState])

  const handleDeleteRow = useCallback(async () => {
    try {
      const result = await deleteRowOrColumn(bingo.id, "row")
      if (result.success) {
        updateBingoState(result.tiles, result.bingo)
        toast({
          title: "Row deleted",
          description: "The last row has been deleted from the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting row:", error)
      toast({
        title: "Error",
        description: "Failed to delete row",
        variant: "destructive",
      })
    }
  }, [bingo.id, updateBingoState])

  const handleDeleteColumn = useCallback(async () => {
    try {
      const result = await deleteRowOrColumn(bingo.id, "column")
      if (result.success) {
        updateBingoState(result.tiles, result.bingo)
        toast({
          title: "Column deleted",
          description: "The last column has been deleted from the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting column:", error)
      toast({
        title: "Error",
        description: "Failed to delete column",
        variant: "destructive",
      })
    }
  }, [bingo.id, updateBingoState])

  const handleReorderTiles = useCallback(
    async (reorderedTiles: Tile[]) => {
      const updatedTiles = reorderedTiles.map((tile, index) => ({
        id: tile.id,
        index,
      }))

      const result = await reorderTiles(updatedTiles)
      if (result.success) {
        updateBingoState(reorderedTiles, bingo)
        toast({
          title: "Tiles reordered",
          description: "The tiles have been successfully reordered and saved.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to reorder tiles",
          variant: "destructive",
        })
      }
    },
    [updateBingoState, bingo]
  )

  const highlightTilesToDelete = useCallback(
    (type: "row" | "column") => {
      if (!bingo.tiles) {
        bingo.tiles = []
      }
      const tilesToHighlight =
        type === "row"
          ? bingo.tiles.slice(-bingo.columns)
          : bingo.tiles.filter((_, index) => (index + 1) % bingo.columns === 0)
      setHighlightedTiles(tilesToHighlight.map((tile) => tile.index))
    },
    [bingo]
  )

  const clearHighlightedTiles = useCallback(() => {
    setHighlightedTiles([])
  }, [])

  const isManagement = userRole === "admin" || userRole === "management"

  return (
    <div key={updateKey} className="space-y-4">
      {isManagement && (
        <div className="mb-4 flex flex-wrap gap-4">
          <Button
            onClick={handleToggleLock}
            className="flex items-center justify-center"
          >
            {isLayoutLocked ? (
              <Unlock className="mr-2 h-4 w-4" />
            ) : (
              <Lock className="mr-2 h-4 w-4" />
            )}
            {isLayoutLocked ? "Unlock Board" : "Lock Board"}
          </Button>
          <AnimatePresence>
            {!isLayoutLocked && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex gap-2"
              >
                <div className="flex-col-1 flex gap-2">
                  <Button
                    onClick={handleAddRow}
                    className="flex items-center justify-center"
                  >
                    <PlusSquare className="mr-2 h-4 w-4" />
                    Row
                  </Button>
                  <Button
                    onClick={handleDeleteRow}
                    onMouseEnter={() => highlightTilesToDelete("row")}
                    onMouseLeave={clearHighlightedTiles}
                    className="flex items-center justify-center"
                  >
                    <MinusSquare className="mr-2 h-4 w-4" />
                    Row
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleAddColumn}
                    className="flex items-center justify-center"
                  >
                    <PlusSquare className="mr-2 h-4 w-4" />
                    Column
                  </Button>
                  <Button
                    onClick={handleDeleteColumn}
                    onMouseEnter={() => highlightTilesToDelete("column")}
                    onMouseLeave={clearHighlightedTiles}
                    className="flex items-center justify-center"
                  >
                    <MinusSquare className="mr-2 h-4 w-4" />
                    Column
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <BingoGrid
        key={`${bingo.rows}-${bingo.columns}-${updateKey}`}
        bingo={bingo}
        userRole={userRole}
        currentTeamId={selectedTeamId}
        teams={teams}
        isLayoutLocked={isLayoutLocked}
        onReorderTiles={handleReorderTiles}
        highlightedTiles={highlightedTiles}
      />
    </div>
  )
}
