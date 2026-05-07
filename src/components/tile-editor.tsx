"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  updateTile,
  addGoal,
  deleteGoal,
  updateGoalProgress,
  submitImage,
  updateTeamTileSubmissionStatus,
  deleteTile,
  deleteSubmission,
  updateSubmissionStatus,
  getSelectableUsersForSubmission,
  type SelectableUser,
} from "@/app/actions/bingo"
import { getSubmissions } from "@/app/actions/getSubmissions"
import "@mdxeditor/editor/style.css"
import "@/styles/modal-animations.css"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type {
  Bingo,
  Tile,
  Team,
  EventRole,
  Goal,
  Submission,
} from "@/app/actions/events"
import { TileDetailsTab } from "./tile-details-tab"
import { GoalsTab } from "./goals-tab"
import { SubmissionsTab } from "./submissions-tab"
import { FullSizeImageDialog } from "./full-size-image-dialog"
import { Zap } from "lucide-react"
import { useSession } from "next-auth/react"

interface ExtendedSubmission extends Submission {
  goalId?: string | null
}

interface TileEditorProps {
  tile: Tile
  bingo: Bingo
  userRole: EventRole
  teams: Team[]
  gameType: "osrs" | "rs3"
  currentTeamId: string | undefined
  isLayoutLocked: boolean
  onClose: () => void
  onTileUpdated?: () => void
  onTileChanged: (tileId: string, patch: Partial<Tile>) => void
  onTileDeleted: (tileId: string) => void
}

export function TileEditor({
  tile,
  bingo,
  userRole,
  teams,
  gameType,
  currentTeamId,
  isLayoutLocked,
  onClose,
  onTileUpdated,
  onTileChanged,
  onTileDeleted,
}: TileEditorProps) {
  const [selectedTile, setSelectedTile] = useState<Tile>(tile)
  const [editedTile, setEditedTile] = useState<Partial<Tile>>(tile)
  const [newGoal, setNewGoal] = useState<Partial<Goal>>({ targetValue: 1 })
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [pastedImage, setPastedImage] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [fullSizeImage, setFullSizeImage] = useState<{
    src: string
    alt: string
  } | null>(null)
  const [selectableUsers, setSelectableUsers] = useState<SelectableUser[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>(
    undefined
  )
  const session = useSession()

  // Fetch selectable users on mount
  useEffect(() => {
    if (currentTeamId && bingo.eventId) {
      const fetchUsers = async () => {
        try {
          const users = await getSelectableUsersForSubmission(
            bingo.eventId,
            currentTeamId
          )
          setSelectableUsers(users)
          if (users.length > 0) {
            setSelectedUserId(users[0]!.id)
          }
        } catch (error) {
          console.error("Failed to fetch selectable users:", error)
        }
      }
      void fetchUsers()
    }
  }, [currentTeamId, bingo.eventId])

  const handlePaste = useCallback(
    (event: ClipboardEvent) => {
      if (bingo.locked) return
      if (isUploadingImage) return

      event.preventDefault()
      const items = event.clipboardData?.items
      if (items) {
        for (const item of items) {
          if (item.type.startsWith("image/")) {
            const blob = item.getAsFile()
            if (blob) {
              const file = new File([blob], "pasted-image.png", {
                type: blob.type,
              })
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
    [bingo, isUploadingImage]
  )

  useEffect(() => {
    document.addEventListener("paste", handlePaste)
    return () => {
      document.removeEventListener("paste", handlePaste)
    }
  }, [handlePaste])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && ["1", "2", "3"].includes(event.key)) {
        event.preventDefault()
        const tabValues = ["details", "goals", "submissions"]
        const tabIndex = parseInt(event.key) - 1
        const tabValue = tabValues[tabIndex]
        if (tabValue) {
          const tabTrigger = document.querySelector(
            `[data-state]:not([data-state="active"])[value="${tabValue}"]`
          ) as HTMLElement
          if (tabTrigger) {
            tabTrigger.click()
          }
        }
      }

      if (event.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  const handleTileUpdate = async () => {
    if (editedTile) {
      const result = await updateTile(selectedTile.id, editedTile)
      if (result.success) {
        onTileChanged(selectedTile.id, editedTile)
        onTileUpdated?.()
        onClose()
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
    if (newGoal.description && newGoal.targetValue != null) {
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
        const updatedGoals = [...(selectedTile.goals ?? []), updatedGoal]
        setSelectedTile((prev) => ({ ...prev, goals: updatedGoals }))
        onTileChanged(selectedTile.id, { goals: updatedGoals })
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
    const result = await deleteGoal(goalId)
    if (result.success) {
      const updatedGoals = selectedTile.goals?.filter((g) => g.id !== goalId)
      setSelectedTile((prev) => ({ ...prev, goals: updatedGoals }))
      onTileChanged(selectedTile.id, { goals: updatedGoals })
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

  const handleProgressUpdate = async (
    goalId: string,
    teamId: string,
    newValue: number
  ) => {
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
                    teamProgress:
                      goal.teamProgress?.map((progress) =>
                        progress.teamId === teamId
                          ? { ...progress, currentValue: newValue }
                          : progress
                      ) || [],
                  }
                : goal
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
      const patch = { teamTileSubmissions: submissions }
      setSelectedTile((prev) => ({ ...prev, ...patch }))
      onTileChanged(tileId, patch)
    } catch (error) {
      console.error("Error refreshing submissions:", error)
      toast({
        title: "Error",
        description: "Failed to refresh submissions",
        variant: "destructive",
      })
    }
  }

  const handleImageSubmit = async (onBehalfOfUserId?: string) => {
    if (isUploadingImage) return

    if (bingo.locked) {
      toast({
        title: "Submissions locked",
        description: "Submissions are currently locked for this bingo board",
        variant: "destructive",
      })
      return
    }

    if (!(selectedImage || pastedImage) || !currentTeamId) {
      toast({
        title: "Error",
        description: "Missing required information for submission",
        variant: "destructive",
      })
      return
    }

    setIsUploadingImage(true)

    try {
      const formData = new FormData()
      formData.append("image", selectedImage ?? pastedImage!)
      formData.append("tileId", selectedTile.id)
      formData.append("teamId", currentTeamId)

      if (onBehalfOfUserId) {
        formData.append("onBehalfOfUserId", onBehalfOfUserId)
      }

      const result = await submitImage(formData)

      if (result.success) {
        setSelectedImage(null)
        setPastedImage(null)
        toast({
          title: "Image submitted",
          description: "Your image has been successfully submitted for review",
        })
        await refreshSubmissions(selectedTile.id)
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to submit image",
          variant: "destructive",
        })
      }
    } finally {
      setIsUploadingImage(false)
    }
  }

  const handleTeamTileSubmissionStatusUpdate = async (
    teamTileSubmissionId: string | undefined,
    newStatus: "approved" | "needs_review"
  ) => {
    if (!teamTileSubmissionId) {
      toast({
        title: "Error",
        description: "No submission found for this team",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await updateTeamTileSubmissionStatus(
        teamTileSubmissionId,
        newStatus
      )
      if (result.success) {
        const updateSubmissions = (submissions: any[] | undefined) =>
          submissions?.map((tts) =>
            tts.id === teamTileSubmissionId
              ? { ...tts, status: newStatus }
              : tts
          )

        setSelectedTile((prev) => ({
          ...prev,
          teamTileSubmissions: updateSubmissions(prev.teamTileSubmissions),
        }))
        onTileChanged(selectedTile.id, {
          teamTileSubmissions: updateSubmissions(
            selectedTile.teamTileSubmissions
          ),
        })

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
    try {
      const result = await deleteSubmission(submissionId)
      if (result.success) {
        const filterSubmissions = (tileData: Tile): Tile => ({
          ...tileData,
          teamTileSubmissions: tileData.teamTileSubmissions?.map((tts) => ({
            ...tts,
            submissions: tts.submissions.filter(
              (sub) => sub.id !== submissionId
            ),
          })),
        })

        setSelectedTile((prev) => filterSubmissions(prev))
        const updated = filterSubmissions(selectedTile)
        onTileChanged(selectedTile.id, {
          teamTileSubmissions: updated.teamTileSubmissions,
        })

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

    const confirmDelete = window.confirm(
      "Are you sure you want to delete this tile?"
    )
    if (!confirmDelete) return

    try {
      const result = await deleteTile(tileId, bingo.id)
      if (result.success) {
        onTileDeleted(tileId)
        onClose()
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

  // Updated to handle goal assignment with proper typing including value and weight
  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null
  ) => {
    try {
      console.log(
        `Updating submission ${submissionId} with status ${newStatus}, goalId ${goalId}, value ${submissionValue}`
      )

      // Only allow approved or needs_review to be passed to the server action
      const validStatus = newStatus === "pending" ? "needs_review" : newStatus

      const result = await updateSubmissionStatus(
        submissionId,
        validStatus,
        goalId,
        submissionValue
      )
      if (result.success) {
        const applyUpdate = (tileData: Tile): Tile => {
          if (!tileData.teamTileSubmissions) return tileData
          return {
            ...tileData,
            teamTileSubmissions: tileData.teamTileSubmissions.map((tts) => ({
              ...tts,
              submissions: tts.submissions.map((sub) => {
                if (sub.id !== submissionId) return sub
                const updatedSub = { ...sub } as ExtendedSubmission
                updatedSub.status = newStatus
                updatedSub.reviewedBy = session.data?.user?.id || null
                updatedSub.reviewedAt = new Date()
                if (goalId !== undefined) updatedSub.goalId = goalId
                if (submissionValue !== undefined)
                  updatedSub.submissionValue = submissionValue
                return updatedSub
              }),
            })),
          }
        }

        setSelectedTile((prev) => applyUpdate(prev))
        const updated = applyUpdate(selectedTile)
        onTileChanged(selectedTile.id, {
          teamTileSubmissions: updated.teamTileSubmissions,
        })

        const message =
          goalId !== undefined
            ? `Submission ${newStatus.replace("_", " ")}, goal ${goalId ? "assigned" : "removed"}${submissionValue ? ` with value ${submissionValue}` : ""}`
            : `Submission marked as ${newStatus.replace("_", " ")}`

        toast({
          title: "Submission updated",
          description: message,
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

  function canManage(): boolean {
    return userRole === "admin" || userRole === "management"
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
        <DialogContent className="modal-content flex h-[90vh] w-[95vw] max-w-[1400px] flex-col overflow-hidden border-border bg-background">
          <DialogHeader className="border-b border-border pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <DialogTitle className="text-2xl font-bold text-foreground">
                  {selectedTile?.title}
                </DialogTitle>
                <div className="flex items-center gap-2 rounded-full border border-yellow-500/30 bg-gradient-to-r from-yellow-500/20 to-yellow-600/20 px-3 py-1.5">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold text-yellow-500">
                    {selectedTile?.weight} XP
                  </span>
                </div>
              </div>
            </div>
            <DialogDescription className="mt-2 text-sm text-muted-foreground">
              Manage tile details, goals, and submissions for your bingo event
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="details" className="flex flex-1 flex-col">
            <TabsList className="mb-4 grid h-14 w-full grid-cols-3 rounded-lg border border-border bg-muted/50 p-1">
              <TabsTrigger
                value="details"
                className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                  <span>Tile Details</span>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="goals"
                className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span>Goals</span>
                </div>
              </TabsTrigger>
              <TabsTrigger
                value="submissions"
                className="rounded-md font-medium text-muted-foreground transition-all duration-200 hover:text-foreground data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-purple-500"></div>
                  <span>Submissions</span>
                </div>
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value="details"
              className="tab-content flex-1 space-y-6 overflow-y-auto"
            >
              <TileDetailsTab
                selectedTile={selectedTile}
                editedTile={editedTile}
                userRole={userRole}
                teams={teams}
                gameType={gameType}
                isProgressionBingo={bingo.bingoType === "progression"}
                onEditTile={(field, value) =>
                  setEditedTile({ ...editedTile, [field]: value })
                }
                onUpdateTile={handleTileUpdate}
                onEditorChange={handleEditorChange}
                onUpdateProgress={handleProgressUpdate}
              />
            </TabsContent>
            <TabsContent
              value="goals"
              className="tab-content flex-1 space-y-6 overflow-y-auto"
            >
              <GoalsTab
                selectedTile={selectedTile}
                newGoal={newGoal}
                hasSufficientRights={canManage()}
                onDeleteGoal={handleDeleteGoal}
                onAddGoal={handleAddGoal}
                onNewGoalChange={(field, value) =>
                  setNewGoal({ ...newGoal, [field]: value })
                }
              />
            </TabsContent>
            <TabsContent
              value="submissions"
              className="tab-content flex-1 space-y-6 overflow-y-auto"
            >
              <SubmissionsTab
                selectedTile={selectedTile}
                currentTeamId={currentTeamId}
                teams={teams}
                hasSufficientRights={canManage()}
                selectedImage={selectedImage}
                pastedImage={pastedImage}
                isSubmissionsLocked={bingo.locked}
                isUploadingImage={isUploadingImage}
                onImageChange={handleImageChange}
                onImageSubmit={handleImageSubmit}
                onFullSizeImageView={(src, alt) =>
                  setFullSizeImage({ src, alt })
                }
                onTeamTileSubmissionStatusUpdate={
                  handleTeamTileSubmissionStatusUpdate
                }
                onSubmissionStatusUpdate={handleSubmissionStatusUpdate}
                onDeleteSubmission={handleDeleteSubmission}
                selectableUsers={selectableUsers}
                selectedUserId={selectedUserId}
                onUserSelect={setSelectedUserId}
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
    </>
  )
}
