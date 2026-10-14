"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, RefreshCw } from "lucide-react"
import {
  deleteSubmission,
  updateSubmissionStatus,
  updateTeamTileSubmissionStatus,
} from "@/app/actions/bingo"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"
import { SubmissionsTab } from "@/components/submissions-tab"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import type { Team, TeamTileSubmission } from "@/types/model"

interface BingoSubmissionsClientProps {
  eventId: string
  bingoTitle: string
  teams: Team[]
  teamTileSubmissions: TeamTileSubmission[]
}

/**
 * The review view of one Board's Submissions. The page only renders for
 * managers, so every review control is on. The data is server props; after a
 * change the route is refreshed to load it again.
 */
export function BingoSubmissionsClient({
  eventId,
  bingoTitle,
  teams,
  teamTileSubmissions,
}: BingoSubmissionsClientProps) {
  const router = useRouter()
  const [fullSizeImage, setFullSizeImage] = useState<{
    src: string
    alt: string
  } | null>(null)

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/events/${eventId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">
              {bingoTitle} - Tile Submissions
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.refresh()}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="min-h-[60vh] rounded-lg border border-border bg-card shadow-xs">
          <SubmissionsTab
            selectedTile={null}
            teamTileSubmissions={teamTileSubmissions}
            teams={teams}
            hasSufficientRights
            isAdminView
            currentTeamId={undefined}
            isSubmissionsLocked={false}
            selectedImage={null}
            pastedImage={null}
            isUploadingImage={false}
            onImageChange={() => {}}
            onImageSubmit={() => {}}
            onFullSizeImageView={(src, alt) => setFullSizeImage({ src, alt })}
            onTeamTileSubmissionStatusUpdate={async (id, status) => {
              if (!id) return
              try {
                const result = await updateTeamTileSubmissionStatus(id, status)
                if (result && "success" in result && !result.success) {
                  throw new Error(result.error)
                }
                toast({ title: "Success", description: "Tile status updated." })
                router.refresh()
              } catch {
                toast({
                  title: "Error",
                  description: "Failed to update tile.",
                  variant: "destructive",
                })
              }
            }}
            onSubmissionStatusUpdate={async (
              id,
              status,
              goalId,
              submissionValue
            ) => {
              try {
                const result = await updateSubmissionStatus(
                  id,
                  status,
                  goalId,
                  submissionValue
                )
                if (!result.success) {
                  throw new Error(
                    "error" in result
                      ? result.error
                      : "Failed to update submission"
                  )
                }
                toast({
                  title: "Success",
                  description: "Submission updated successfully.",
                })
                router.refresh()
              } catch (e) {
                const message =
                  e instanceof Error
                    ? e.message
                    : "Failed to update submission."
                toast({
                  title: "Error",
                  description: message,
                  variant: "destructive",
                })
              }
            }}
            onDeleteSubmission={async (id) => {
              try {
                const result = await deleteSubmission(id)
                if (!result.success) {
                  throw new Error(
                    "error" in result
                      ? result.error
                      : "Failed to delete submission"
                  )
                }
                toast({ title: "Success", description: "Submission deleted." })
                router.refresh()
              } catch (e) {
                const message =
                  e instanceof Error
                    ? e.message
                    : "Failed to delete submission."
                toast({
                  title: "Error",
                  description: message,
                  variant: "destructive",
                })
              }
            }}
          />
        </div>
      </div>

      {fullSizeImage && (
        <FullSizeImageDialog
          isOpen={!!fullSizeImage}
          onClose={() => setFullSizeImage(null)}
          imageSrc={fullSizeImage.src}
          imageAlt={fullSizeImage.alt}
        />
      )}
    </div>
  )
}
