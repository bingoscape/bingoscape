"use client"

import { SubmissionsTab } from "@/components/submissions-tab"
import { updateTeamTileSubmissionStatus, updateSubmissionStatus, deleteSubmission } from "@/app/actions/bingo"
import { useState } from "react"
import { toast } from "@/hooks/use-toast"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import type { Team } from "@/types/model"

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
            const result = await updateSubmissionStatus(id, status, goalId, submissionValue)
            if (!result.success) throw new Error(result.error)
            toast({ title: "Success", description: "Submission updated successfully." })
          } catch {
            toast({ title: "Error", description: "Failed to update submission.", variant: "destructive" })
          }
        }}
        onDeleteSubmission={async (id) => {
          try {
            const result = await deleteSubmission(id)
            if (!result.success) throw new Error("error" in result ? result.error : "Failed to delete submission")
            toast({ title: "Success", description: "Submission deleted." })
          } catch (e) {
            const message = e instanceof Error ? e.message : "Failed to delete submission."
            toast({ title: "Error", description: message, variant: "destructive" })
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
