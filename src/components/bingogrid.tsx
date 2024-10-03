'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Image from 'next/image'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import Sortable, { type SortableEvent } from 'sortablejs'
import { toast } from '@/hooks/use-toast'
import { updateTile, reorderTiles, addGoal, deleteGoal, getTileGoalsAndProgress, updateGoalProgress, submitImage, getSubmissions, updateTeamTileSubmissionStatus, addRowOrColumn } from '@/app/actions/bingo'
import { BingoTile } from './bingo-tile'
import { ForwardRefEditor } from './forward-ref-editor'
import '@mdxeditor/editor/style.css'
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Trash2, Lock, Unlock, Upload, X, Clock, Check, PlusSquare } from 'lucide-react'
import type { Bingo, Tile, Team, EventRole, Goal } from '@/app/actions/events'

interface BingoGridProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
}

export default function BingoGrid({ bingo, userRole, teams, currentTeamId }: BingoGridProps) {
  const [tiles, setTiles] = useState<Tile[]>(bingo.tiles)
  const [rows, setRows] = useState(bingo.rows)
  const [columns, setColumns] = useState(bingo.columns)
  const [selectedTile, setSelectedTile] = useState<Tile | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editedTile, setEditedTile] = useState<Partial<Tile>>({})
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({})
  const [isLocked, setIsOrderingEnabled] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [pastedImage, setPastedImage] = useState<File | null>(null)
  const [fullSizeImage, setFullSizeImage] = useState<{ src: string; alt: string } | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const sortableRef = useRef<Sortable | null>(null)

  useEffect(() => {
    if (gridRef.current && hasSufficientRights() && isLocked) {
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
            void handleReorderTiles(reorderedTiles)
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
  }, [tiles, userRole, isLocked])

  const toggleOrdering = () => {
    setIsOrderingEnabled(!isLocked)
    if (!isLocked) {
      toast({
        title: "Tile ordering enabled",
        description: "You can now drag and drop tiles to reorder them.",
      })
    } else {
      toast({
        title: "Tile ordering disabled",
        description: "Tile ordering has been locked.",
      })
    }
  }

  const handleAddRow = async () => {
    try {
      const result = await addRowOrColumn(bingo.id, 'row')
      if (result.success) {
        setRows(rows + 1)
        setTiles(result.tiles)
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
  }

  const handleAddColumn = async () => {
    try {
      const result = await addRowOrColumn(bingo.id, 'column')
      if (result.success) {
        setColumns(columns + 1)
        setTiles(result.tiles)
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
  }

  const handleReorderTiles = async (reorderedTiles: Tile[]) => {
    const updatedTiles = reorderedTiles.map((tile, index) => ({
      id: tile.id,
      index
    }))

    const result = await reorderTiles(updatedTiles)
    if (result.success) {
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
      setTiles(bingo.tiles) // Revert to original order if server update fails
    }
  }

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
        // Refresh submissions immediately after successful upload
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

  const renderCodephrase = () => (
    <div className="bg-primary text-primary-foreground p-4 rounded-lg shadow-md mb-6">
      <h2 className="text-2xl font-bold mb-2">Codephrase</h2>
      <p className="text-xl">{bingo.codephrase}</p>
    </div>
  )

  const renderGoals = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Goals</h3>
      {selectedTile?.goals?.map(goal => (
        <div key={goal.id} className="flex justify-between items-center">
          <span>{goal.description} (Target: {goal.targetValue})</span>
          {hasSufficientRights() && (
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
      {hasSufficientRights() && (
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
          {hasSufficientRights() ? (
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

  const renderSubmissions = () => {
    if (!selectedTile) {
      return (<p>No tile selected</p>)
    }

    const teamSubmissions = selectedTile.teamTileSubmissions?.find(tts => tts.teamId === currentTeamId)?.submissions ?? []

    return (
      <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
        <h3 className="text-lg font-semibold sticky top-0 bg-background z-10 py-2">Submissions</h3>
        {currentTeamId ? (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer"
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <p>Click to select an image or paste an image here</p>
              {(selectedImage ?? pastedImage) && (
                <p className="mt-2 text-sm text-green-600">Image ready to submit</p>
              )}
            </div>
            <Input
              id="file-input"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <Button onClick={handleImageSubmit} disabled={!selectedImage && !pastedImage}>
              <Upload className="mr-2 h-4 w-4" />
              Submit Image
            </Button>
            <div className="grid grid-cols-2 gap-4">
              {teamSubmissions.map(submission => (
                <div key={submission.id} className="border rounded-md p-4">
                  <div className="relative w-full h-48">
                    <Image
                      src={submission.image.path}
                      alt={`Submission for ${selectedTile.title}`}
                      layout="fill"
                      objectFit="cover"
                      className="rounded-md cursor-pointer"
                      onClick={() => setFullSizeImage({ src: submission.image.path, alt: `Submission for ${selectedTile.title}` })}
                    />
                  </div>
                  <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p>You need to be part of a team to submit images.</p>
        )}

        {hasSufficientRights() && (
          <div className="mt-8 space-y-4">
            <h4 className="text-lg font-semibold sticky top-12 bg-background z-10 py-2">All Team Submissions</h4>
            {teams.map(team => {
              const teamTileSubmission = selectedTile?.teamTileSubmissions?.find(tts => tts.teamId === team.id)
              const hasSubmissions = teamTileSubmission?.submissions.length ?? 0 > 0
              return (
                <div key={team.id} className="space-y-2">
                  <h5 className="font-medium sticky top-24 bg-background z-10 py-2">{team.name}</h5>
                  <div className="flex items-center space-x-2 mb-2 sticky top-32 bg-background z-10 py-2">
                    <p className="text-sm">Status: {teamTileSubmission?.status ?? 'No submission'}</p>
                    {hasSubmissions && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'accepted')}
                        >
                          <Check className="h-4 w-4 text-green-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'requires_interaction')}
                        >
                          <Clock className="h-4 w-4 text-yellow-500" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, 'declined')}
                        >
                          <X className="h-4 w-4 text-red-500" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {teamTileSubmission?.submissions.map(submission => (
                      <div key={submission.id} className="border rounded-md p-4">
                        <Image
                          src={submission.image.path}
                          alt={`Submission for ${selectedTile?.title} by ${team.name}`}
                          width={200}
                          height={200}
                          className="object-cover rounded-md cursor-pointer"
                          onClick={() => setFullSizeImage({ src: submission.image.path, alt: `Submission for ${selectedTile?.title} by ${team.name}` })}
                        />
                        <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const handleTeamTileSubmissionStatusUpdate = async (teamTileSubmissionId: string | undefined, newStatus: 'accepted' | 'requires_interaction' | 'declined') => {
    if (!teamTileSubmissionId) {
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
            return {
              ...prev,
              teamTileSubmissions: prev.teamTileSubmissions?.map(tts =>
                tts.id === teamTileSubmissionId ? { ...tts, status: newStatus } : tts
              )
            }
          }
          return null
        })
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

  return (
    <div className="space-y-4">
      {renderCodephrase()}
      {hasSufficientRights() && (
        <div className="flex justify-end space-x-2">
          <Button onClick={toggleOrdering} variant="outline">
            {isLocked ? <Unlock className="mr-2 h-4 w-4" /> : <Lock className="mr-2 h-4 w-4" />}
            {isLocked ? 'Lock' : 'Unlock'}
          </Button>
        </div>
      )}
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
          <BingoTile
            key={tile.id}
            tile={tile}
            onClick={() => handleTileClick(tile)}
            userRole={userRole}
            currentTeamId={currentTeamId}
          />
        ))}
      </div>
      {hasSufficientRights() && isLocked && (
        <div className="flex justify-end space-x-2">
          <Button onClick={handleAddRow} variant="outline">
            <PlusSquare className="mr-2 h-4 w-4" />
            Add Row
          </Button>
          <Button onClick={handleAddColumn} variant="outline">
            <PlusSquare className="mr-2 h-4 w-4" />
            Add Column
          </Button>
        </div>
      )}

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
              {renderTileDetails()}
            </TabsContent>
            <TabsContent value="goals" className="h-full overflow-y-auto">
              {renderGoals()}
            </TabsContent>
            <TabsContent value="submissions" className="h-full overflow-y-auto">
              {renderSubmissions()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <Dialog open={!!fullSizeImage} onOpenChange={() => setFullSizeImage(null)}>
        <DialogTitle>Submission</DialogTitle>
        <DialogContent className="sm:max-w-[90vw] sm:max-h-[90vh] p-0">
          {fullSizeImage && (
            <div className="relative w-full h-full min-h-[50vh]">
              <Image
                src={fullSizeImage.src}
                alt={fullSizeImage.alt}
                layout="fill"
                objectFit="contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div >
  )

  function hasSufficientRights(): boolean {
    return userRole === 'admin' || userRole === 'management'
  }
}
