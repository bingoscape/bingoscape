"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import {
  deleteGoal,
  deleteSubmission,
  submitImage,
  updateGoalProgress,
  updateSubmissionStatus,
  updateTeamTileSubmissionStatus,
  updateTile,
} from "@/app/actions/bingo"
import type { Bingo, SelectableUser, Tile } from "@/types/model"

type EditableField =
  | "title"
  | "description"
  | "weight"
  | "headerImage"
  | "isHidden"
  | "tier"

const EDITABLE_FIELDS: EditableField[] = [
  "title",
  "description",
  "weight",
  "headerImage",
  "isHidden",
  "tier",
]

const NO_EDITS: Partial<Tile> = {}

interface UseTileWorkspaceArgs {
  /** The selected Tile, taken from server props (never copied into state). */
  tile: Tile | null
  bingo: Pick<Bingo, "locked">
  currentTeamId: string | undefined
  /** Server-fetched users the caller may submit on behalf of. */
  selectableUsers: SelectableUser[]
  /** Listen for pasted images (only while the Submissions tab is visible). */
  pasteEnabled: boolean
}

/**
 * Holds the transient UI state of the Tile panel (edit buffer,
 * image upload, on-behalf-of selection) and the mutation handlers. The Tile
 * itself always comes from server props; after every mutation the route is
 * refreshed (`router.refresh()`), so there is a single source of truth.
 */
export function useTileWorkspace({
  tile,
  bingo,
  currentTeamId,
  selectableUsers,
  pasteEnabled,
}: UseTileWorkspaceArgs) {
  const router = useRouter()
  const [isRefreshing, startTransition] = useTransition()

  const tileId = tile?.id ?? null

  // Edit buffer, keyed by Tile so switching Tiles discards unsaved edits.
  const [edits, setEdits] = useState<{
    tileId: string | null
    values: Partial<Tile>
  }>({ tileId: null, values: {} })
  const activeEdits = edits.tileId === tileId ? edits.values : NO_EDITS

  const editedTile = useMemo<Partial<Tile>>(
    () => ({ ...(tile ?? {}), ...activeEdits }),
    [tile, activeEdits]
  )

  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [pastedImage, setPastedImage] = useState<File | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [fullSizeImage, setFullSizeImage] = useState<{
    src: string
    alt: string
  } | null>(null)
  const [selectedUserOverride, setSelectedUserOverride] = useState<
    string | undefined
  >(undefined)

  // Default to the first selectable user (the caller) until one is picked.
  const selectedUserId = selectedUserOverride ?? selectableUsers[0]?.id

  // Drop the upload draft when the Tile changes.
  const [draftTileId, setDraftTileId] = useState<string | null>(tileId)
  if (draftTileId !== tileId) {
    setDraftTileId(tileId)
    setSelectedImage(null)
    setPastedImage(null)
  }

  const refresh = useCallback(() => {
    startTransition(() => {
      router.refresh()
    })
  }, [router])

  const onEditTile = useCallback(
    (field: string, value: unknown) => {
      setEdits((prev) => ({
        tileId,
        values: {
          ...(prev.tileId === tileId ? prev.values : {}),
          [field]: value,
        },
      }))
    },
    [tileId]
  )

  const onEditorChange = useCallback(
    (content: string) => onEditTile("description", content),
    [onEditTile]
  )

  const onUpdateTile = useCallback(async () => {
    if (!tile) return
    const payload: Record<string, unknown> = {}
    for (const field of EDITABLE_FIELDS) {
      const value = editedTile[field]
      if (value !== undefined) payload[field] = value
    }

    const result = await updateTile(tile.id, payload)
    if (result.success) {
      setEdits({ tileId: null, values: {} })
      toast({
        title: "Tile updated",
        description: "The tile has been successfully updated.",
      })
      refresh()
    } else {
      toast({
        title: "Error",
        description: result.error ?? "Failed to update tile",
        variant: "destructive",
      })
    }
  }, [tile, editedTile, refresh])

  const onDeleteGoal = useCallback(
    async (goalId: string) => {
      const result = await deleteGoal(goalId)
      if (result.success) {
        toast({
          title: "Goal deleted",
          description: "The goal has been successfully deleted from the tile.",
        })
        refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to delete goal",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  const onUpdateProgress = useCallback(
    async (goalId: string, teamId: string, newValue: number) => {
      const result = await updateGoalProgress(goalId, teamId, newValue)
      if (result.success) {
        toast({
          title: "Progress updated",
          description: "The goal progress has been successfully updated.",
        })
        refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update goal progress",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  const onImageChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (file) setSelectedImage(file)
    },
    []
  )

  const onImageSubmit = useCallback(
    async (onBehalfOfUserId?: string) => {
      if (isUploadingImage) return

      if (bingo.locked) {
        toast({
          title: "Submissions locked",
          description: "Submissions are currently locked for this bingo board",
          variant: "destructive",
        })
        return
      }

      if (!tile || !(selectedImage || pastedImage) || !currentTeamId) {
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
        formData.append("image", (selectedImage ?? pastedImage)!)
        formData.append("tileId", tile.id)
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
            description:
              "Your image has been successfully submitted for review",
          })
          refresh()
        } else {
          toast({
            title: "Error",
            description: result.error ?? "Failed to submit image",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error submitting image:", error)
        toast({
          title: "Error",
          description: "Failed to submit image",
          variant: "destructive",
        })
      } finally {
        setIsUploadingImage(false)
      }
    },
    [
      isUploadingImage,
      bingo.locked,
      tile,
      selectedImage,
      pastedImage,
      currentTeamId,
      refresh,
    ]
  )

  // Paste an image from the clipboard while the Submissions tab is visible.
  useEffect(() => {
    if (!pasteEnabled || bingo.locked || isUploadingImage) return

    const handlePaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return
      }
      for (const item of event.clipboardData?.items ?? []) {
        if (item.type.startsWith("image/")) {
          const blob = item.getAsFile()
          if (blob) {
            event.preventDefault()
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

    document.addEventListener("paste", handlePaste)
    return () => document.removeEventListener("paste", handlePaste)
  }, [pasteEnabled, bingo.locked, isUploadingImage])

  const onTeamTileSubmissionStatusUpdate = useCallback(
    async (
      teamTileSubmissionId: string | undefined,
      newStatus: "completed" | "needs_attention"
    ) => {
      if (!teamTileSubmissionId) {
        toast({
          title: "Error",
          description: "No submission found for this team",
          variant: "destructive",
        })
        return
      }
      const result = await updateTeamTileSubmissionStatus(
        teamTileSubmissionId,
        newStatus
      )
      if (result.success) {
        toast({
          title: "Status updated",
          description: `Submission marked as ${newStatus.replace("_", " ")}`,
        })
        refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update submission status",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  const onSubmissionStatusUpdate = useCallback(
    async (
      submissionId: string,
      newStatus: "pending" | "approved" | "needs_review",
      goalId?: string | null,
      submissionValue?: number | null
    ) => {
      // Only approved / needs_review can be sent to the server action.
      const validStatus = newStatus === "pending" ? "needs_review" : newStatus
      const result = await updateSubmissionStatus(
        submissionId,
        validStatus,
        goalId,
        submissionValue
      )
      if (result.success) {
        const message =
          goalId !== undefined
            ? `Submission ${newStatus.replace("_", " ")}, goal ${goalId ? "assigned" : "removed"}${submissionValue ? ` with value ${submissionValue}` : ""}`
            : `Submission marked as ${newStatus.replace("_", " ")}`
        toast({ title: "Submission updated", description: message })
        refresh()
      } else {
        toast({
          title: "Error",
          description: result.error ?? "Failed to update submission status",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  const onDeleteSubmission = useCallback(
    async (submissionId: string) => {
      const result = await deleteSubmission(submissionId)
      if (result.success) {
        toast({
          title: "Submission deleted",
          description: "The submission has been successfully deleted.",
        })
        refresh()
      } else {
        toast({
          title: "Error",
          description:
            ("error" in result ? result.error : undefined) ??
            "Failed to delete submission",
          variant: "destructive",
        })
      }
    },
    [refresh]
  )

  return {
    isRefreshing,
    editedTile,
    onEditTile,
    onEditorChange,
    onUpdateTile,
    onDeleteGoal,
    onUpdateProgress,
    selectedImage,
    pastedImage,
    isUploadingImage,
    onImageChange,
    onImageSubmit,
    fullSizeImage,
    setFullSizeImage,
    selectableUsers,
    selectedUserId,
    onUserSelect: setSelectedUserOverride,
    onTeamTileSubmissionStatusUpdate,
    onSubmissionStatusUpdate,
    onDeleteSubmission,
    refresh,
  }
}

export type TileWorkspace = ReturnType<typeof useTileWorkspace>
