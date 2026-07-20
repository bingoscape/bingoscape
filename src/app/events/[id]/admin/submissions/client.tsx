"use client"

import { SubmissionsTab } from "@/components/submissions-tab"
import {
  updateTeamTileSubmissionStatus,
  updateSubmissionStatus,
  deleteSubmission,
} from "@/app/actions/bingo"
import { updateSubmissionGoalAndValue } from "@/app/actions/goals"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "@/hooks/use-toast"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"

import { Team } from "@/app/actions/events"

interface ReviewSubmissionsClientProps {
  teamTileSubmissions: unknown[]
  teams: Team[]
  isSubmissionsLocked: boolean
}

export function ReviewSubmissionsClient({
  teamTileSubmissions,
  teams,
  isSubmissionsLocked,
}: ReviewSubmissionsClientProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  
  const [fullSizeImage, setFullSizeImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  return (
    <>
      <SubmissionsTab
        selectedTile={null}
        teamTileSubmissions={teamTileSubmissions}
        teams={teams}
        hasSufficientRights={true}
        isAdminView={true}
        currentTeamId={undefined}
        isSubmissionsLocked={isSubmissionsLocked}
        selectedImage={null}
        pastedImage={null}
        isUploadingImage={false}
        onImageChange={() => {}}
        onImageSubmit={() => {}}
        onFullSizeImageView={(src, alt) => setFullSizeImage({ src, alt })}
        onTeamTileSubmissionStatusUpdate={async (id, status) => {
          if (!id) return
          try {
            await updateTeamTileSubmissionStatus(id, status)
            startTransition(() => {
              router.refresh()
            })
            toast({ title: "Success", description: "Tile status updated." })
          } catch {
            toast({ title: "Error", description: "Failed to update tile.", variant: "destructive" })
          }
        }}
        onSubmissionStatusUpdate={async (
          id,
          status,
          goalId,
          submissionValue
        ) => {
          try {
            await updateSubmissionStatus(id, status)
            if (goalId !== undefined) {
              await updateSubmissionGoalAndValue(
                id,
                goalId,
                submissionValue ?? 1.0
              )
            }
            startTransition(() => {
              router.refresh()
            })
            toast({ title: "Success", description: "Submission updated successfully." })
          } catch {
            toast({ title: "Error", description: "Failed to update submission.", variant: "destructive" })
          }
        }}
        onDeleteSubmission={async (id) => {
          try {
            await deleteSubmission(id)
            startTransition(() => {
              router.refresh()
            })
            toast({ title: "Success", description: "Submission deleted." })
          } catch {
            toast({ title: "Error", description: "Failed to delete submission.", variant: "destructive" })
          }
        }}
      />

      {fullSizeImage && (
        <FullSizeImageDialog
          isOpen={!!fullSizeImage}
          onClose={() => setFullSizeImage(null)}
          imageSrc={fullSizeImage.src}
          imageAlt={fullSizeImage.alt}
        />
      )}
    </>
  )
}
