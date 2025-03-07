import type React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Check, Clock, X, Trash2, AlertCircle } from "lucide-react"
import type { Tile, Team } from "@/app/actions/events"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import getRandomFrog from "@/lib/getRandomFrog"

interface SubmissionsTabProps {
  selectedTile: Tile | null
  currentTeamId: string | undefined
  teams: Team[]
  hasSufficientRights: boolean
  selectedImage: File | null
  pastedImage: File | null
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageSubmit: () => void
  onFullSizeImageView: (src: string, alt: string) => void
  onTeamTileSubmissionStatusUpdate: (
    teamTileSubmissionId: string | undefined,
    newStatus: "accepted" | "requires_interaction" | "declined",
  ) => void
  onDeleteSubmission?: (submissionId: string) => Promise<void>
}

export function SubmissionsTab({
  selectedTile,
  currentTeamId,
  teams,
  hasSufficientRights,
  selectedImage,
  pastedImage,
  onImageChange,
  onImageSubmit,
  onFullSizeImageView,
  onTeamTileSubmissionStatusUpdate,
  onDeleteSubmission,
}: SubmissionsTabProps) {
  if (!selectedTile) {
    return <p>No tile selected</p>
  }

  const teamSubmissions =
    selectedTile.teamTileSubmissions?.find((tts) => tts.teamId === currentTeamId)?.submissions ?? []
  const canDeleteSubmissions = !!onDeleteSubmission && (hasSufficientRights || currentTeamId)

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
      <h3 className="text-lg font-semibold sticky top-0 bg-background z-10 py-2">Submissions</h3>
      {currentTeamId ? (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center cursor-pointer"
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <p>Click to select an image or paste an image here</p>
            {(selectedImage ?? pastedImage) && <p className="mt-2 text-sm text-green-600">Image ready to submit</p>}
          </div>
          <Input id="file-input" type="file" accept="image/*" onChange={onImageChange} className="hidden" />
          <Button onClick={onImageSubmit} disabled={!selectedImage && !pastedImage}>
            <Upload className="mr-2 h-4 w-4" />
            Submit Image
          </Button>

          {teamSubmissions.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {teamSubmissions.map((submission) => (
                <div key={submission.id} className="border rounded-md p-4 relative group">
                  <div className="relative w-full h-48">
                    <Image
                      src={submission.image.path || getRandomFrog()}
                      alt={`Submission for ${selectedTile.title}`}
                      fill
                      style={{ objectFit: "cover" }}
                      className="rounded-md cursor-pointer"
                      onClick={() => onFullSizeImageView(submission.image.path, `Submission for ${selectedTile.title}`)}
                    />

                    {canDeleteSubmissions && (
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-8 w-8">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this submission? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => onDeleteSubmission?.(submission.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </div>
                  <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 italic">No submissions yet</p>
          )}
        </div>
      ) : (
        <p>You need to be part of a team to submit images.</p>
      )}

      {hasSufficientRights && (
        <div className="mt-8 space-y-4">
          <h4 className="text-lg font-semibold sticky top-12 bg-background z-10 py-2">All Team Submissions</h4>
          {teams.map((team) => {
            const teamTileSubmission = selectedTile?.teamTileSubmissions?.find((tts) => tts.teamId === team.id)
            const hasSubmissions = teamTileSubmission?.submissions.length ?? 0 > 0
            return (
              <div key={team.id} className="space-y-2">
                <h5 className="font-medium sticky top-24 bg-background z-10 py-2">{team.name}</h5>
                <div className="flex items-center space-x-2 mb-2 sticky top-32 bg-background z-10 py-2">
                  <p className="text-sm">Status: {teamTileSubmission?.status ?? "No submission"}</p>
                  {hasSubmissions && (
                    <div className="flex space-x-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "accepted")}
                            >
                              <Check className="h-4 w-4 text-green-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Accept</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "requires_interaction")
                              }
                            >
                              <Clock className="h-4 w-4 text-yellow-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Requires Interaction</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "declined")}
                            >
                              <X className="h-4 w-4 text-red-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Decline</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}
                </div>

                {hasSubmissions ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    {teamTileSubmission?.submissions.map((submission) => (
                      <div key={submission.id} className="border rounded-md p-4 relative group">
                        <div className="relative aspect-square">
                          <Image
                            src={submission.image.path || getRandomFrog()}
                            alt={`Submission for ${selectedTile?.title} by ${team.name}`}
                            fill
                            style={{ objectFit: "cover" }}
                            className="rounded-md cursor-pointer"
                            onClick={() =>
                              onFullSizeImageView(
                                submission.image.path,
                                `Submission for ${selectedTile?.title} by ${team.name}`,
                              )
                            }
                          />

                          {canDeleteSubmissions && (
                            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" className="h-8 w-8">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this submission from {team.name}? This action
                                      cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => onDeleteSubmission?.(submission.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                        <p className="mt-2 text-sm">Submitted: {new Date(submission.createdAt).toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No submissions from this team</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!onDeleteSubmission && hasSufficientRights && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md text-amber-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm">Delete functionality is not available. Contact your administrator for assistance.</p>
        </div>
      )}
    </div>
  )
}
