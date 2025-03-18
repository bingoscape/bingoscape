"use client"

import type React from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Check, Clock, X, Trash2, ImageIcon } from "lucide-react"
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
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
  const hasImageSelected = !!(selectedImage || pastedImage)

  // Get current team's submission status
  const currentTeamSubmission = selectedTile.teamTileSubmissions?.find((tts) => tts.teamId === currentTeamId)
  const currentStatus = currentTeamSubmission?.status || "pending"

  // Status badge colors
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "accepted":
        return <Badge className="bg-green-500">Accepted</Badge>
      case "requires_interaction":
        return <Badge className="bg-yellow-500">Requires Interaction</Badge>
      case "declined":
        return <Badge className="bg-red-500">Declined</Badge>
      default:
        return <Badge className="bg-blue-500">Pending</Badge>
    }
  }

  return (
    <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
      {currentTeamId && (
        <Card className="overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-base font-medium">Your Submission</h3>
              {currentTeamSubmission && getStatusBadge(currentStatus)}
            </div>

            {/* Only show upload UI if status is not accepted */}
            {currentStatus !== "accepted" ? (
              <>
                <div className="flex gap-2 mb-3">
                  <div
                    className={`flex-1 border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${hasImageSelected ? "border-green-500 bg-green-50" : "border-gray-300"
                      }`}
                    onClick={() => document.getElementById("file-input")?.click()}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <ImageIcon className="h-4 w-4" />
                      <span className="text-sm">
                        {hasImageSelected ? "Image ready to submit" : "Click to select or paste an image"}
                      </span>
                    </div>
                  </div>
                  <Button onClick={onImageSubmit} disabled={!hasImageSelected} className="shrink-0">
                    <Upload className="mr-2 h-4 w-4" />
                    Submit
                  </Button>
                </div>
                <Input id="file-input" type="file" accept="image/*" onChange={onImageChange} className="hidden" />
              </>
            ) : (
              <div className="flex items-center gap-2 p-2 bg-green-50 rounded-md mb-3 text-green-700 text-sm">
                <Check className="h-4 w-4" />
                <span>Your submission has been accepted!</span>
              </div>
            )}

            {/* Existing submissions */}
            {teamSubmissions.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {teamSubmissions.map((submission) => (
                  <div key={submission.id} className="relative group aspect-square">
                    <Image
                      src={submission.image.path || getRandomFrog()}
                      alt={`Submission for ${selectedTile.title}`}
                      fill
                      style={{ objectFit: "cover" }}
                      className="rounded-md cursor-pointer"
                      onClick={() => onFullSizeImageView(submission.image.path, `Submission for ${selectedTile.title}`)}
                    />
                    {canDeleteSubmissions && (
                      <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="icon" className="h-6 w-6">
                              <Trash2 className="h-3 w-3" />
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
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                      {new Date(submission.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 italic">No submissions yet</p>
            )}
          </CardContent>
        </Card>
      )}

      {hasSufficientRights && (
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="all">All Submissions</TabsTrigger>
            <TabsTrigger value="pending">Pending Review</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-2 space-y-4">
            {teams.map((team) => {
              const teamTileSubmission = selectedTile?.teamTileSubmissions?.find((tts) => tts.teamId === team.id)
              const hasSubmissions = (teamTileSubmission?.submissions.length ?? 0) > 0

              if (!hasSubmissions) return null

              return (
                <Card key={team.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{team.name}</h4>
                      <div className="flex items-center gap-1">
                        {getStatusBadge(teamTileSubmission?.status || "pending")}
                        <div className="flex space-x-1 ml-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "accepted")}
                                >
                                  <Check className="h-3 w-3 text-green-500" />
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
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "requires_interaction")
                                  }
                                >
                                  <Clock className="h-3 w-3 text-yellow-500" />
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
                                  className="h-6 w-6 p-0"
                                  onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "declined")}
                                >
                                  <X className="h-3 w-3 text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Decline</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {teamTileSubmission?.submissions.map((submission) => (
                        <div key={submission.id} className="relative group aspect-square">
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
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" className="h-6 w-6">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this submission from {team.name}?
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

                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>

          <TabsContent value="pending" className="mt-2 space-y-4">
            {teams.map((team) => {
              const teamTileSubmission = selectedTile?.teamTileSubmissions?.find((tts) => tts.teamId === team.id)
              const isPending = teamTileSubmission?.status === "pending" || !teamTileSubmission?.status
              const hasSubmissions = (teamTileSubmission?.submissions.length ?? 0) > 0

              if (!hasSubmissions || !isPending) return null

              return (
                <Card key={team.id} className="overflow-hidden">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-sm">{team.name}</h4>
                      <div className="flex items-center gap-1">
                        <Badge className="bg-blue-500">Pending</Badge>
                        <div className="flex space-x-1 ml-2">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-6 w-6 p-0"
                                  onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "accepted")}
                                >
                                  <Check className="h-3 w-3 text-green-500" />
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
                                  className="h-6 w-6 p-0"
                                  onClick={() =>
                                    onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "requires_interaction")
                                  }
                                >
                                  <Clock className="h-3 w-3 text-yellow-500" />
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
                                  className="h-6 w-6 p-0"
                                  onClick={() => onTeamTileSubmissionStatusUpdate(teamTileSubmission?.id, "declined")}
                                >
                                  <X className="h-3 w-3 text-red-500" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Decline</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                      {teamTileSubmission?.submissions.map((submission) => (
                        <div key={submission.id} className="relative group aspect-square">
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
                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="destructive" size="icon" className="h-6 w-6">
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this submission from {team.name}?
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

                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-xs p-1 truncate">
                            {new Date(submission.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </TabsContent>
        </Tabs>
      )}

      {!currentTeamId && !hasSufficientRights && (
        <div className="p-4 bg-gray-50 rounded-md text-center">
          <p>You need to be part of a team to submit images.</p>
        </div>
      )}
    </div>
  )
}

