'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import Sortable, { type SortableEvent } from 'sortablejs'
import { toast } from '@/hooks/use-toast'
import { updateTile, reorderTiles, addGoal, deleteGoal, getTileGoalsAndProgress, updateGoalProgress } from '@/app/actions/bingo'
import { BingoTile } from './bingo-tile'
import { ForwardRefEditor } from './forward-ref-editor'
import '@mdxeditor/editor/style.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2 } from 'lucide-react'

interface ServerTeamProgress {
  id: string
  updatedAt: Date
  teamId: string
  goalId: string
  currentValue: number
}

interface ServerGoal {
  id: string
  description: string
  targetValue: number
  createdAt: Date
  updatedAt: Date
  tileId: string
  teamProgress: ServerTeamProgress[]
}

interface TeamProgress {
  teamId: string
  teamName: string
  currentValue: number
}

interface Goal {
  id: string
  description: string
  targetValue: number
  teamProgress: TeamProgress[]
}

interface Tile {
  id: string
  title: string
  headerImage: string | null
  description: string
  weight: number
  index: number
  goals?: Goal[]
}

interface BingoGridProps {
  rows: number
  columns: number
  tiles: Tile[]
  isEventAdmin: boolean
  userRole: 'participant' | 'management' | 'admin'
  teams: { id: string; name: string }[]
}

export default function BingoGrid({ rows, columns, tiles: initialTiles, isEventAdmin, userRole, teams }: BingoGridProps) {
  const [tiles, setTiles] = useState<Tile[]>(initialTiles)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editedTile, setEditedTile] = useState<Partial<Tile>>({})
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({})
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (gridRef.current && isEventAdmin) {
      const sortable = new Sortable(gridRef.current, {
        animation: 150,
        ghostClass: 'bg-blue-100',
        onEnd: (_: SortableEvent) => {
          (async () => {
            const updatedTiles = tiles.map((tile, index) => ({
              id: tile.id,
              index: index
            }))
            const result = await reorderTiles(updatedTiles)
            if (result.success) {
              setTiles(prevTiles => prevTiles.map((tile, index) => ({ ...tile, index })))
              toast({
                title: "Tiles reordered",
                description: "The tiles have been successfully reordered.",
              })
            } else {
              toast({
                title: "Error",
                description: result.error ?? "Failed to reorder tiles",
                variant: "destructive",
              })
            }
          })().then(() =>
            console.log("done")
          ).catch(e => console.error(e));
        }
      })

      return () => {
        sortable.destroy()
      }
    }
  }, [tiles, isEventAdmin])

  const handleTileClick = async (tile: Tile) => {
    try {
      const serverGoals = await getTileGoalsAndProgress(tile.id)
      const goals: Goal[] = serverGoals.map((serverGoal: ServerGoal) => ({
        id: serverGoal.id,
        description: serverGoal.description,
        targetValue: serverGoal.targetValue,
        teamProgress: teams.map(team => {
          const progress = serverGoal.teamProgress.find(p => p.teamId === team.id)
          return {
            teamId: team.id,
            teamName: team.name,
            currentValue: progress ? progress.currentValue : 0
          }
        })
      }))
      const updatedTile: Tile = { ...tile, goals }
      setSelectedTile(updatedTile)
      setEditedTile(updatedTile)
      setIsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching goals:", error)
      toast({
        title: "Error",
        description: "Failed to fetch goals",
        variant: "destructive",
      })
    }
  }

  const handleTileUpdate = async () => {
    if (selectedTile && editedTile) {
      const result = await updateTile(selectedTile.id, editedTile)
      if (result.success) {
        setTiles(prevTiles => prevTiles.map(tile =>
          tile.id === selectedTile.id ? { ...tile, ...editedTile } : tile
        ))
        setIsDialogOpen(false)
        toast({
          title: "Tile updated",
          description: "The tile has been successfully updated.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update tile",
          variant: "destructive",
        })
      }
    }
  }

  const handleEditorChange = (content: string) => {
    setEditedTile(prev => ({ ...prev, description: content }))
  }

  const handleAddGoal = async () => {
    if (selectedTile && newGoal.description && newGoal.targetValue) {
      const result = await addGoal(selectedTile.id, newGoal as Goal)
      if (result.success && result.goal) {
        const updatedGoal: Goal = {
          id: result.goal.id,
          description: result.goal.description,
          targetValue: result.goal.targetValue,
          teamProgress: teams.map(team => ({
            teamId: team.id,
            teamName: team.name,
            currentValue: 0
          }))
        }
        setSelectedTile(prev => {
          if (prev) {
            return {
              ...prev,
              goals: [...(prev.goals ?? []), updatedGoal]
            }
          }
          return null
        })
        setTiles(prevTiles => prevTiles.map(tile =>
          tile.id === selectedTile.id
            ? { ...tile, goals: [...(tile.goals ?? []), updatedGoal] }
            : tile
        ))
        setNewGoal({})
        toast({
          title: "Goal added",
          description: "The goal has been successfully added to the tile.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to add goal",
          variant: "destructive",
        })
      }
    }
  }

  const handleDeleteGoal = async (goalId: string) => {
    if (selectedTile) {
      const result = await deleteGoal(goalId)
      if (result.success) {
        setSelectedTile(prev => prev ? { ...prev, goals: prev.goals?.filter(g => g.id !== goalId) } : null)
        setTiles(prevTiles => prevTiles.map(tile =>
          tile.id === selectedTile.id ? { ...tile, goals: tile.goals?.filter(g => g.id !== goalId) } : tile
        ))
        toast({
          title: "Goal deleted",
          description: "The goal has been successfully deleted from the tile.",
        })
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to delete goal",
          variant: "destructive",
        })
      }
    }
  }

  const handleProgressUpdate = async (goalId: string, teamId: string, newValue: number) => {
    const result = await updateGoalProgress(goalId, teamId, newValue)
    if (result.success) {
      setSelectedTile(prev => {
        if (prev?.goals) {
          return {
            ...prev,
            goals: prev.goals.map(goal =>
              goal.id === goalId
                ? {
                  ...goal,
                  teamProgress: goal.teamProgress.map(progress =>
                    progress.teamId === teamId
                      ? { ...progress, currentValue: newValue }
                      : progress
                  )
                }
                : goal
            )
          }
        }
        return prev
      })
      toast({
        title: "Progress updated",
        description: "The goal progress has been successfully updated.",
      })
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to update goal progress",
        variant: "destructive",
      })
    }
  }

  const renderGoals = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Goals</h3>
      {selectedTile?.goals?.map(goal => (
        <div key={goal.id} className="flex justify-between items-center">
          <span>{goal.description} (Target: {goal.targetValue})</span>
          {(userRole === 'management' || userRole === 'admin') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeleteGoal(goal.id)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ))}
      {(userRole === 'management' || userRole === 'admin') && (
        <>
          <h3 className="text-lg font-semibold">Add New Goal</h3>
          <div className="space-y-2">
            <Input
              placeholder="Goal description"
              value={newGoal.description ?? ''}
              onChange={(e) => setNewGoal({ ...newGoal, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Target value"
              value={newGoal.targetValue ?? ''}
              onChange={(e) => setNewGoal({ ...newGoal, targetValue: parseInt(e.target.value) })}
            />
            <Button onClick={handleAddGoal}>Add Goal</Button>
          </div>
        </>
      )}
    </div>
  )

  const renderTileProgress = () => {
    if (!selectedTile?.goals) return null

    return (
      <div className="space-y-6 mt-6">
        <h3 className="text-lg font-semibold">Team Progress</h3>
        {teams.map(team => (
          <div key={team.id} className="space-y-2">
            <h4 className="font-medium">{team.name}</h4>
            {selectedTile.goals?.map(goal => {
              const teamProgress = goal.teamProgress.find(progress => progress.teamId === team.id)
              return (
                <div key={goal.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{goal.description}</span>
                    <span>{teamProgress?.currentValue ?? 0} / {goal.targetValue}</span>
                  </div>
                  <Progress
                    value={(teamProgress?.currentValue ?? 0) / goal.targetValue * 100}
                    className="h-2"
                    aria-label={`Progress for ${team.name} on ${goal.description}`}
                  />
                </div>
              )
            })}
          </div>
        ))}
      </div>
    )
  }

  const renderTileDetails = () => (
    <div className="space-y-6">
      <div className="flex gap-6">
        <div className="w-1/3 relative aspect-square">
          {selectedTile?.headerImage ? (
            <Image
              src={selectedTile.headerImage}
              alt={selectedTile.title}
              fill
              className="object-contain rounded-md"
            />
          ) : (
            <div className="w-full h-full bg-gray-200 rounded-md flex items-center justify-center">
              <span className="text-gray-400">No image</span>
            </div>
          )}
        </div>
        <div className="w-2/3 space-y-4">
          {isEventAdmin ? (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="title" className="text-right">
                  Title
                </label>
                <Input
                  id="title"
                  value={editedTile.title ?? ''}
                  onChange={(e) => setEditedTile({ ...editedTile, title: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="description" className="text-right">
                  Description
                </label>
                <div className="col-span-3 h-[200px] overflow-y-auto border rounded-md">
                  <ForwardRefEditor
                    onChange={handleEditorChange}
                    markdown={editedTile.description ?? ''}
                    contentEditableClassName="prose max-w-full"
                  />
                </div>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="weight" className="text-right">
                  Weight
                </label>
                <Input
                  id="weight"
                  type="number"
                  value={editedTile.weight ?? ''}
                  onChange={(e) => setEditedTile({ ...editedTile, weight: parseInt(e.target.value) })}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="headerImage" className="text-right">
                  Header Image URL
                </label>
                <Input
                  id="headerImage"
                  value={editedTile.headerImage ?? ''}
                  onChange={(e) => setEditedTile({ ...editedTile, headerImage: e.target.value })}
                  className="col-span-3"
                />
              </div>
              <div className="flex justify-end">
                <Button onClick={handleTileUpdate}>Update Tile</Button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-lg font-semibold">{selectedTile?.title}</h3>
              <div className="prose max-w-full" dangerouslySetInnerHTML={{ __html: selectedTile?.description ?? '' }} />
              <p>Weight: {selectedTile?.weight}</p>
            </>
          )}
        </div>
      </div>
      {renderTileProgress()}
    </div>
  )

  return (
    <div
      ref={gridRef}
      className="grid gap-2 w-full h-full"
      style={{
        gridTemplateColumns: `repeat(${columns}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        aspectRatio: `${columns} / ${rows}`
      }}
    >
      {tiles.map((tile) => (
        <BingoTile key={tile.id} tile={tile} onClick={() => handleTileClick(tile)} />
      ))}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px]">
          <DialogHeader>
            <DialogTitle>{selectedTile?.title}</DialogTitle>
            <DialogDescription>Weight: {selectedTile?.weight}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details">
            <TabsList>
              <TabsTrigger value="details">Tile Details</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
            </TabsList>
            <TabsContent value="details">
              {renderTileDetails()}
            </TabsContent>
            <TabsContent value="goals">
              {renderGoals()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  )
}
