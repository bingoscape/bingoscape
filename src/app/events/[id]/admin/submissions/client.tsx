"use client"

import { SubmissionsTab } from "@/components/submissions-tab"
import {
  updateTeamTileSubmissionStatus,
  updateSubmissionStatus,
  deleteSubmission,
} from "@/app/actions/bingo"
import { updateSubmissionGoalAndValue } from "@/app/actions/goals"
import { useState } from "react"
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
          if (id) {
            await updateTeamTileSubmissionStatus(id, status)
          }
        }}
        onSubmissionStatusUpdate={async (
          id,
          status,
          goalId,
          submissionValue
        ) => {
          await updateSubmissionStatus(id, status)
          if (goalId !== undefined) {
            await updateSubmissionGoalAndValue(
              id,
              goalId,
              submissionValue ?? 1.0
            )
          }
        }}
        onDeleteSubmission={async (id) => {
          await deleteSubmission(id)
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
