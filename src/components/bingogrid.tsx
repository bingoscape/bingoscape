'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from '@/hooks/use-toast'
import { updateTile, reorderTiles, addGoal, deleteGoal, getTileGoalsAndProgress, updateGoalProgress, submitImage, getSubmissions, updateTeamTileSubmissionStatus, deleteTile } from '@/app/actions/bingo'
import '@mdxeditor/editor/style.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Bingo, Tile, Team, EventRole, Goal } from '@/app/actions/events'
import Sortable, { type SortableEvent } from 'sortablejs'
import { BingoGridLayout } from './bingo-grid-layout'
import { TileDetailsTab } from './tile-details-tab'
import { GoalsTab } from './goals-tab'
import { SubmissionsTab } from './submissions-tab'
import { FullSizeImageDialog } from './full-size-image-dialog'

interface BingoGridProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
  isLocked: boolean
  onReorderTiles?: (reorderedTiles: Tile[]) => void
}

export default function BingoGrid({ bingo, userRole, teams, currentTeamId, isLocked, onReorderTiles }: BingoGridProps) {
  const [tiles, setTiles] = useState<Tile[]>(bingo.tiles ?? [])
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editedTile, setEditedTile] = useState<Partial<Tile>>({})
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({})
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [pastedImage, setPastedImage] = useState<File | null>(null)
  const [fullSizeImage, setFullSizeImage] = useState<{ src: string; alt: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const sortableRef = useRef<Sortable | null>(null)

  useEffect(() => {
    if (gridRef.current && hasSufficientRights() && !isLocked) {
      sortableRef.current = new Sortable(gridRef.current, {
        animation: 150,
        ghostClass: 'bg-blue-100',
        onEnd: (event: SortableEvent) => {
          const { oldIndex, newIndex } = event
          if (oldIndex !== newIndex) {
            const updatedTiles = [...tiles]
            const [movedTile] = updatedTiles.splice(oldIndex!, 1)
            updatedTiles.splice(newIndex!, 0, movedTile!)

            const reorderedTiles = updatedTiles.map((tile, index) => ({
              ...tile,
              index
            }))

            setTiles(reorderedTiles)
            if (!!onReorderTiles) onReorderTiles(reorderedTiles)
          }
        }
      })

      return () => {
        if (sortableRef.current) {
          sortableRef.current.destroy()
          sortableRef.current = null
        }
      }
    }
  }, [tiles, userRole, isLocked, onReorderTiles])

  const handleTileClick = async (tile: Tile) => {
    try {
      const goals = await getTileGoalsAndProgress(tile.id)
      const teamTileSubmissions = await getSubmissions(tile.id)
      const updatedTile: Tile = { ...tile, goals, teamTileSubmissions }
      setSelectedTile(updatedTile)
      setEditedTile(updatedTile)
      setIsDialogOpen(true)
    } catch (error) {
      console.error("Error fetching tile data:", error)
      toast({
        title: "Error",
        description: "Failed to fetch tile data",
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
          tileId: result.goal.tileId,
          description: result.goal.description,
          targetValue: result.goal.targetValue,
          teamProgress: teams.map(team => ({
            teamId: team.id,
            teamName: team.name,
            goalId: result.goal!.id,
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

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedImage(file)
    }
  }

  const refreshSubmissions = async (tileId: string) => {
    try {
      const submissions = await getSubmissions(tileId)
      setSelectedTile(prev => {
        if (prev && prev.id === tileId) {
          return {
            ...prev,
            teamTileSubmissions: submissions
          }
        }
        return prev
      })
      setTiles(prevTiles => prevTiles.map(tile =>
        tile.id === tileId
          ? { ...tile, teamTileSubmissions: submissions }
          : tile
      ))
    } catch (error) {
      console.error("Error refreshing submissions:", error)
      toast({
        title: "Error",
        description: "Failed to refresh submissions",
        variant: "destructive",
      })
    }
  }

  const handleImageSubmit = async () => {
    if (selectedTile && (selectedImage || pastedImage) && currentTeamId) {
      const formData = new FormData()
      formData.append('image', selectedImage ?? pastedImage!)
      formData.append('tileId', selectedTile.id)
      formData.append('teamId', currentTeamId)

      const result = await submitImage(formData)
      if (result.success) {
        setSelectedImage(null)
        setPastedImage(null)
        toast({
          title: "Image submitted",
          description: "Your image has been successfully submitted for review.",
        })
        await refreshSubmissions(selectedTile.id)
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to submit image",
          variant: "destructive",
        })
      }
    }
  }

  const handlePaste = useCallback((event: ClipboardEvent) => {
    event.preventDefault()
    const items = event.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (blob) {
            const file = new File([blob], 'pasted-image.png', { type: blob.type })
            setPastedImage(file)
            setSelectedImage(file)
            toast({
              title: "Image pasted",
              description: "Your pasted image is ready to be submitted.",
            })
            break
          }
        }
      }
    }
  }, [])

  useEffect(() => {
    document.addEventListener('paste', handlePaste)
    return () => {
      document.removeEventListener('paste', handlePaste)
    }
  }, [handlePaste])

  const handleTeamTileSubmissionStatusUpdate = async (teamTileSubmissionId: string | undefined, newStatus: 'accepted' | 'requires_interaction' | 'declined') => {
    if (!teamTileSubmissionId || !selectedTile) {
      toast({
        title: "Error",
        description: "No submission found for this team",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await updateTeamTileSubmissionStatus(teamTileSubmissionId, newStatus)
      if (result.success) {
        setSelectedTile(prev => {
          if (prev) {
            const updatedTeamTileSubmissions = prev.teamTileSubmissions?.map(tts =>
              tts.id === teamTileSubmissionId ? { ...tts, status: newStatus } : tts
            )
            return {
              ...prev,
              teamTileSubmissions: updatedTeamTileSubmissions
            }
          }
          return null
        })

        setTiles(prevTiles => prevTiles.map(tile =>
          tile.id === selectedTile.id
            ? {
              ...tile,
              teamTileSubmissions: tile.teamTileSubmissions?.map(tts =>
                tts.id === teamTileSubmissionId ? { ...tts, status: newStatus } : tts
              )
            }
            : tile
        ))

        toast({
          title: "Submission status updated",
          description: `The team's submission status has been set to ${newStatus}.`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error updating team tile submission status:", error)
      toast({
        title: "Error",
        description: "Failed to update team tile submission status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTile = async (tileId: string) => {
    if (isLocked) return

    const confirmDelete = window.confirm("Are you sure you want to delete this tile?")
    if (!confirmDelete) return

    try {
      const result = await deleteTile(tileId, bingo.id)
      if (result.success) {
        setTiles(prevTiles => prevTiles.filter(tile => tile.id !== tileId))
        toast({
          title: "Tile deleted",
          description: "The tile has been successfully deleted.",
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error deleting tile:", error)
      toast({
        title: "Error",
        description: "Failed to delete tile",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <BingoGridLayout
        ref={gridRef}
        tiles={tiles}
        columns={bingo.columns}
        rows={bingo.rows}
        userRole={userRole}
        currentTeamId={currentTeamId}
        onTileClick={handleTileClick}
        onDeleteTile={handleDeleteTile}
        isLocked={isLocked}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>{selectedTile?.title}</DialogTitle>
            <DialogDescription>Weight: {selectedTile?.weight}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="h-full">
            <TabsList>
              <TabsTrigger value="details">Tile Details</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>

            </TabsList>
            <TabsContent value="details" className="h-full overflow-y-auto">
              <TileDetailsTab
                selectedTile={selectedTile}
                editedTile={editedTile}
                userRole={userRole}
                teams={teams}
                onEditTile={(field, value) => setEditedTile({ ...editedTile, [field]: value })}
                onUpdateTile={handleTileUpdate}
                onEditorChange={handleEditorChange}
              />
            </TabsContent>
            <TabsContent value="goals" className="h-full overflow-y-auto">
              <GoalsTab
                selectedTile={selectedTile}
                newGoal={newGoal}
                hasSufficientRights={hasSufficientRights()}
                onDeleteGoal={handleDeleteGoal}
                onAddGoal={handleAddGoal}
                onNewGoalChange={(field, value) => setNewGoal({ ...newGoal, [field]: value })}
              />
            </TabsContent>
            <TabsContent value="submissions" className="h-full overflow-y-auto">
              <SubmissionsTab
                selectedTile={selectedTile}
                currentTeamId={currentTeamId}
                teams={teams}
                hasSufficientRights={hasSufficientRights()}
                selectedImage={selectedImage}
                pastedImage={pastedImage}
                onImageChange={handleImageChange}
                onImageSubmit={handleImageSubmit}
                onFullSizeImageView={(src, alt) => setFullSizeImage({ src, alt })}
                onTeamTileSubmissionStatusUpdate={handleTeamTileSubmissionStatusUpdate}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <FullSizeImageDialog
        isOpen={!!fullSizeImage}
        onClose={() => setFullSizeImage(null)}
        imageSrc={fullSizeImage?.src ?? ''}
        imageAlt={fullSizeImage?.alt ?? ''}
      />
    </div>
  )

  function hasSufficientRights(): boolean {
    return userRole === 'admin' || userRole === 'management'
  }
}
