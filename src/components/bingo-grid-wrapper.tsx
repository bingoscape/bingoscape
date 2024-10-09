'use client'

import { useState, useCallback } from 'react'
import BingoGrid from '@/components/bingogrid'
import { Button } from '@/components/ui/button'
import { Lock, Unlock, PlusSquare } from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { addRowOrColumn, reorderTiles } from '@/app/actions/bingo'
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

  const handleToggleLock = useCallback(async () => {
    // TODO: Implement the actual API call to toggle the lock state
    setIsLocked(prevIsLocked => !prevIsLocked)
    setBingo(prevBingo => ({ ...prevBingo, locked: !prevBingo.locked }))
    toast({
      title: isLocked ? "Bingo board unlocked" : "Bingo board locked",
      description: isLocked ? "You can now edit the bingo board." : "The bingo board is now locked.",
    })
  }, [isLocked])

  const handleAddRow = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, 'row')
      if (result.success) {
        setBingo(prevBingo => ({
          ...prevBingo,
          rows: prevBingo.rows + 1,
          tiles: result.tiles
        }))
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
  }, [bingo.id])

  const handleAddColumn = useCallback(async () => {
    try {
      const result = await addRowOrColumn(bingo.id, 'column')
      if (result.success) {
        setBingo(prevBingo => ({
          ...prevBingo,
          columns: prevBingo.columns + 1,
          tiles: result.tiles
        }))
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
  }, [bingo.id])

  const handleReorderTiles = useCallback(async (reorderedTiles: Tile[]) => {
    const updatedTiles = reorderedTiles.map((tile, index) => ({
      id: tile.id,
      index
    }))

    const result = await reorderTiles(updatedTiles)
    if (result.success) {
      setBingo(prevBingo => ({
        ...prevBingo,
        tiles: reorderedTiles
      }))
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
  }, [])

  const isManagement = userRole === 'admin' || userRole === 'management'

  return (
    <>
      {isManagement && (
        <div className="flex space-x-4 mb-4">
          <Button onClick={handleToggleLock}>
            {isLocked ? <Unlock className="mr-2" /> : <Lock className="mr-2" />}
            {isLocked ? 'Unlock Board' : 'Lock Board'}
          </Button>
          <Button onClick={handleAddRow}>
            <PlusSquare className="mr-2" />
            Add Row
          </Button>
          <Button onClick={handleAddColumn}>
            <PlusSquare className="mr-2" />
            Add Column
          </Button>
        </div>
      )}
      <BingoGrid
        key={`${bingo.rows}-${bingo.columns}`}
        bingo={bingo}
        userRole={userRole}
        currentTeamId={currentTeamId}
        teams={teams}
        isLocked={isLocked}
        onReorderTiles={handleReorderTiles}
      />
    </>
  )
}
