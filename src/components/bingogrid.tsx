/* eslint-disable */
"use client"

import type React from "react"

import { useState, useEffect, useRef, useCallback } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  updateTile,
  addGoal,
  deleteGoal,
  getTileGoalsAndProgress,
  updateGoalProgress,
  submitImage,
  getSubmissions,
  updateTeamTileSubmissionStatus,
  deleteTile,
  deleteSubmission,
  updateSubmissionStatus,
} from "@/app/actions/bingo"
import "@mdxeditor/editor/style.css"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { Bingo, Tile, Team, EventRole, Goal } from "@/app/actions/events"
import Sortable, { type SortableEvent } from "sortablejs"
import { BingoGridLayout } from "./bingo-grid-layout"
import { TileDetailsTab } from "./tile-details-tab"
import { GoalsTab } from "./goals-tab"
import { SubmissionsTab } from "./submissions-tab"
import { FullSizeImageDialog } from "./full-size-image-dialog"
import { StatsDialog } from "./stats-dialog"
import { BarChart, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"

interface BingoGridProps {
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  currentTeamId: string | undefined
  isLayoutLocked: boolean // Controls whether the board layout can be modified
  onReorderTiles?: (reorderedTiles: Tile[]) => void
  highlightedTiles: number[]
  onTileUpdated?: () => void
}

export default function BingoGrid({
  bingo,
  userRole,
  teams,
  currentTeamId,
  isLayoutLocked,
  onReorderTiles,
  highlightedTiles,
  onTileUpdated,
}: BingoGridProps) {
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
  const [isStatsDialogOpen, setIsStatsDialogOpen] = useState(false)
  const searchParams = useSearchParams()
  const session = useSession()

  // Get the selected team ID from URL params or use the current team ID
  const selectedTeamId = searchParams.get("teamId") ?? currentTeamId

  useEffect(() => {
    if (gridRef.current && hasSufficientRights() && !isLayoutLocked) {
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

            // Update the indices of the swapped tiles
            const minIndex = Math.min(oldIndex!, newIndex!)
            const maxIndex = Math.max(oldIndex!, newIndex!)
            for (let i = minIndex; i <= maxIndex; i++) {
              updatedTiles[i] = { ...updatedTiles[i], index: i } as Tile
            }

            setTiles(updatedTiles)
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
  }, [tiles, isLayoutLocked, onReorderTiles])

  const handleTileClick = async (tile: Tile) => {
    if (tile.isHidden && !isLayoutLocked && hasSufficientRights()) {
      await handleTogglePlaceholder(tile)
      return
    }
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
      setTiles((prevTiles) => prevTiles.map((t) => (t.id === tile.id ? updatedTile : t)))
      if (onTileUpdated) {
        onTileUpdated()
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

  const handleTileUpdate = async () => {
    if (selectedTile && editedTile) {
      const result = await updateTile(selectedTile.id, editedTile)
      if (result.success) {
        setTiles((prevTiles) =>
          prevTiles.map((tile) => (tile.id === selectedTile.id ? { ...tile, ...editedTile } : tile)),
        )
        if (onTileUpdated) {
          onTileUpdated()
        }
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
    setEditedTile((prev) => ({ ...prev, description: content }))
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
          teamProgress: teams.map((team) => ({
            teamId: team.id,
            teamName: team.name,
            goalId: result.goal!.id,
            currentValue: 0,
          })),
        }
        setSelectedTile((prev) => {
          if (prev) {
            return {
              ...prev,
              goals: [...(prev.goals ?? []), updatedGoal],
            }
          }
          return null
        })
        setTiles((prevTiles) =>
          prevTiles.map((tile) =>
            tile.id === selectedTile.id ? { ...tile, goals: [...(tile.goals ?? []), updatedGoal] } : tile,
          ),
        )
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
        setSelectedTile((prev) => (prev ? { ...prev, goals: prev.goals?.filter((g) => g.id !== goalId) } : null))
        setTiles((prevTiles) =>
          prevTiles.map((tile) =>
            tile.id === selectedTile.id ? { ...tile, goals: tile.goals?.filter((g) => g.id !== goalId) } : tile,
          ),
        )
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
      setSelectedTile((prev) => {
        if (prev?.goals) {
          return {
            ...prev,
            goals: prev.goals.map((goal) =>
              goal.id === goalId
                ? {
                  ...goal,
                  teamProgress: goal.teamProgress.map((progress) =>
                    progress.teamId === teamId ? { ...progress, currentValue: newValue } : progress,
                  ),
                }
                : goal,
            ),
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
      setSelectedTile((prev) => {
        if (prev && prev.id === tileId) {
          return {
            ...prev,
            teamTileSubmissions: submissions,
          }
        }
        return prev
      })
      setTiles((prevTiles) =>
        prevTiles.map((tile) => (tile.id === tileId ? { ...tile, teamTileSubmissions: submissions } : tile)),
      )
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
    if (bingo.locked) {
      toast({
        title: "Submissions locked",
        description: "This bingo board is currently locked for submissions.",
        variant: "destructive",
      })
      return
    }

    if (!selectedTile || !(selectedImage || pastedImage) || !currentTeamId) {
      toast({
        title: "Error",
        description: "Missing required information for submission",
        variant: "destructive",
      })
      return
    }

    const formData = new FormData()
    formData.append("image", selectedImage ?? pastedImage!)
    formData.append("tileId", selectedTile.id)
    formData.append("teamId", currentTeamId)

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

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (bingo.locked) return

      event.preventDefault()
      const items = event.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile()
            if (blob) {
              const file = new File([blob], "pasted-image.png", { type: blob.type })
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
    },
    [bingo],
  )

  useEffect(() => {
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [handlePaste])

  const handleTeamTileSubmissionStatusUpdate = async (
    teamTileSubmissionId: string | undefined,
    newStatus: "accepted" | "requires_interaction" | "declined",
  ) => {
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
        // Update local state with the new status
        const updateSubmissions = (submissions: any[] | undefined) =>
          submissions?.map((tts) => (tts.id === teamTileSubmissionId ? { ...tts, status: newStatus } : tts))

        setSelectedTile((prev) =>
          prev ? { ...prev, teamTileSubmissions: updateSubmissions(prev.teamTileSubmissions) } : null,
        )
        setTiles((prevTiles) =>
          prevTiles.map((tile) =>
            tile.id === selectedTile.id
              ? { ...tile, teamTileSubmissions: updateSubmissions(tile.teamTileSubmissions) }
              : tile,
          ),
        )

        toast({
          title: "Status updated",
          description: `Submission marked as ${newStatus.replace("_", " ")}`,
        })
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error("Error updating submission status:", error)
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      })
    }
  }

  const handleDeleteSubmission = async (submissionId: string) => {
    if (!selectedTile) return

    try {
      const result = await deleteSubmission(submissionId)
      if (result.success) {
        // Update the local state to remove the deleted submission
        setSelectedTile((prev) => {
          if (!prev) return null

          const updatedTeamTileSubmissions = prev.teamTileSubmissions?.map((tts) => ({
            ...tts,
            submissions: tts.submissions.filter((sub) => sub.id !== submissionId),
          }))

          return {
            ...prev,
            teamTileSubmissions: updatedTeamTileSubmissions,
          }
        })

        // Update the tiles state as well
        setTiles((prevTiles) =>
          prevTiles.map((tile) => {
            if (tile.id === selectedTile.id) {
              const updatedTeamTileSubmissions = tile.teamTileSubmissions?.map((tts) => ({
                ...tts,
                submissions: tts.submissions.filter((sub) => sub.id !== submissionId),
              }))

              return {
                ...tile,
                teamTileSubmissions: updatedTeamTileSubmissions,
              }
            }
            return tile
          }),
        )

        toast({
          title: "Submission deleted",
          description: "The submission has been successfully deleted.",
        })
      } else {
        throw new Error("Failed to delete submission")
      }
    } catch (error) {
      console.error("Error deleting submission:", error)
      toast({
        title: "Error",
        description: "Failed to delete submission",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTile = async (tileId: string) => {
    if (isLayoutLocked) {
      toast({
        title: "Layout locked",
        description: "The bingo board layout is currently locked for editing.",
      })
      return
    }

    const confirmDelete = window.confirm("Are you sure you want to delete this tile?")
    if (!confirmDelete) return

    try {
      const result = await deleteTile(tileId, bingo.id)
      if (result.success) {
        setTiles((prevTiles) => prevTiles.filter((tile) => tile.id !== tileId))
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

  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "accepted" | "requires_interaction" | "declined",
  ) => {
    try {
      const result = await updateSubmissionStatus(submissionId, newStatus)
      if (result.success) {
        // Update local state for both individual submission and potentially team status
        const updateSubmissionInState = (submissions: any[] | undefined) =>
          submissions?.map((sub) =>
            sub.id === submissionId
              ? { ...sub, status: newStatus, reviewedBy: session.data?.user?.id, reviewedAt: new Date() }
              : sub,
          )

        setSelectedTile((prev) => {
          if (!prev) return null

          const updatedTeamTileSubmissions = prev.teamTileSubmissions?.map((tts) => ({
            ...tts,
            submissions: updateSubmissionInState(tts.submissions) || [],
          }))

          return {
            ...prev,
            teamTileSubmissions: updatedTeamTileSubmissions,
          }
        })

        setTiles((prevTiles) =>
          prevTiles.map((tile) => {
            if (tile.id === selectedTile?.id) {
              const updatedTeamTileSubmissions = tile.teamTileSubmissions?.map((tts) => ({
                ...tts,
                submissions: updateSubmissionInState(tts.submissions) || [],
              }))

              return {
                ...tile,
                teamTileSubmissions: updatedTeamTileSubmissions,
              }
            }
            return tile
          }),
        )

        toast({
          title: "Submission status updated",
          description: `Individual submission marked as ${newStatus.replace("_", " ")}`,
        })
      } else {
        throw new Error(result.error || "Failed to update submission status")
      }
    } catch (error) {
      console.error("Error updating submission status:", error)
      toast({
        title: "Error",
        description: "Failed to update submission status",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-4">
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
      <BingoGridLayout
        ref={gridRef}
        tiles={tiles}
        columns={bingo.columns}
        rows={bingo.rows}
        userRole={userRole}
        currentTeamId={selectedTeamId}
        onTileClick={handleTileClick}
        onTogglePlaceholder={handleTogglePlaceholder}
        highlightedTiles={highlightedTiles}
        isLocked={isLayoutLocked}
      />

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[900px] h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{selectedTile?.title}</DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-md">
                <Zap className="h-4 w-4 text-amber-500" />
                <span className="font-medium">{selectedTile?.weight} XP</span>
              </div>
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="flex-1 flex flex-col">
            <TabsList>
              <TabsTrigger value="details">Tile Details</TabsTrigger>
              <TabsTrigger value="goals">Goals</TabsTrigger>
              <TabsTrigger value="submissions">Submissions</TabsTrigger>
            </TabsList>
            <TabsContent value="details" className="flex-1 overflow-y-auto">
              <TileDetailsTab
                selectedTile={selectedTile}
                editedTile={editedTile}
                userRole={userRole}
                teams={teams}
                onEditTile={(field, value) => setEditedTile({ ...editedTile, [field]: value })}
                onUpdateTile={handleTileUpdate}
                onEditorChange={handleEditorChange}
                onUpdateProgress={handleProgressUpdate}
              />
            </TabsContent>
            <TabsContent value="goals" className="flex-1 overflow-y-auto">
              <GoalsTab
                selectedTile={selectedTile}
                newGoal={newGoal}
                hasSufficientRights={hasSufficientRights()}
                onDeleteGoal={handleDeleteGoal}
                onAddGoal={handleAddGoal}
                onNewGoalChange={(field, value) => setNewGoal({ ...newGoal, [field]: value })}
              />
            </TabsContent>
            <TabsContent value="submissions" className="flex-1 overflow-y-auto">
              <SubmissionsTab
                selectedTile={selectedTile}
                currentTeamId={selectedTeamId}
                teams={teams}
                hasSufficientRights={hasSufficientRights()}
                selectedImage={selectedImage}
                pastedImage={pastedImage}
                isSubmissionsLocked={bingo.locked}
                onImageChange={handleImageChange}
                onImageSubmit={handleImageSubmit}
                onFullSizeImageView={(src, alt) => setFullSizeImage({ src, alt })}
                onTeamTileSubmissionStatusUpdate={handleTeamTileSubmissionStatusUpdate}
                onSubmissionStatusUpdate={handleSubmissionStatusUpdate}
                onDeleteSubmission={handleDeleteSubmission}
              />
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <FullSizeImageDialog
        isOpen={!!fullSizeImage}
        onClose={() => setFullSizeImage(null)}
        imageSrc={fullSizeImage?.src ?? ""}
        imageAlt={fullSizeImage?.alt ?? ""}
      />
      <StatsDialog
        isOpen={isStatsDialogOpen}
        onOpenChange={setIsStatsDialogOpen}
        userRole={userRole}
        currentTeamId={selectedTeamId}
        teams={teams}
        bingoId={bingo.id}
      />
    </div>
  )

  function hasSufficientRights(): boolean {
    return userRole === "admin" || userRole === "management"
  }
}
