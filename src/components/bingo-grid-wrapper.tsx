'use client'

import { useState, useCallback, useEffect } from 'react'
import BingoGrid from '@/components/bingogrid'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, PlusSquare } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { addRowOrColumn, reorderTiles, addTile } from '@/app/actions/bingo'
import type { Bingo, Tile, Team, EventRole } from '@/app/actions/events'

interface BingoGridWrapperProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
}

export default function BingoGridWrapper({ bingo: initialBingo, userRole, teams, currentTeamId }: BingoGridWrapperProps) {
  const [bingo, setBingo] = useState(initialBingo)
  const [isLocked, setIsLocked] = useState(bingo.locked)
  const [updateKey, setUpdateKey] = useState(0)

  useEffect(() => {
    // Force re-render when bingo state changes
    setUpdateKey(prev => prev + 1)
  }, [bingo])

  const handleToggleLock = useCallback(async () => {
    // TODO: Implement the actual API call to toggle the lock state
    setIsLocked(prevIsLocked => !prevIsLocked)
    setBingo(prevBingo => ({ ...prevBingo, locked: !prevBingo.locked }))
    toast({
      title: isLocked ? "Bingo board unlocked" : "Bingo board locked",
      description: isLocked ? "You can now edit the bingo board." : "The bingo board is now locked.",
    })
  }, [isLocked])

  const updateBingoState = useCallback((newTiles: Tile[], bingo: Bingo) => {
    setBingo(prevBingo => ({
      ...prevBingo,
      rows: bingo.rows,
      columns: bingo.columns,
      tiles: newTiles
    }))
  }, [])

  const handleAddRow = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, 'row')
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
      const result = await addRowOrColumn(bingo.id, 'column')
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

  const handleAddTile = useCallback(async () => {
    try {
      const result = await addTile(bingo.id)
      if (result.success) {
        updateBingoState(result.tiles, result.bingo)
        toast({
          title: "Tile added",
          description: "A new tile has been added to the bingo board.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error adding tile:", error)
      toast({
        title: "Error",
        description: "Failed to add tile",
        variant: "destructive",
      })
    }
  }, [bingo.id, updateBingoState])

  const handleReorderTiles = useCallback(async (reorderedTiles: Tile[]) => {
    const updatedTiles = reorderedTiles.map((tile, index) => ({
      id: tile.id,
      index
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
  }, [updateBingoState])

  const isManagement = userRole === 'admin' || userRole === 'management'

  return (
    <div key={updateKey} className="space-y-4">
      {isManagement && (
        <div className="flex flex-wrap gap-4 mb-4">
          <Button onClick={handleToggleLock} className="flex items-center justify-center">
            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {isLocked ? 'Unlock Board' : 'Lock Board'}
          </Button>
          <Button onClick={handleAddRow} className="flex items-center justify-center">
            <PlusSquare className="mr-2 h-4 w-4" />
            Add Row
          </Button>
          <Button onClick={handleAddColumn} className="flex items-center justify-center">
            <PlusSquare className="mr-2 h-4 w-4" />
            Add Column
          </Button>
          <Button onClick={handleAddTile} className="flex items-center justify-center">
            <PlusSquare className="mr-2 h-4 w-4" />
            Add Tile
          </Button>
        </div>
      )}
      <BingoGrid
        key={`${bingo.rows}-${bingo.columns}-${updateKey}`}
        bingo={bingo}
        userRole={userRole}
        currentTeamId={currentTeamId}
        teams={teams}
        isLocked={isLocked}
        onReorderTiles={handleReorderTiles}
      />
    </div>
  )
}
