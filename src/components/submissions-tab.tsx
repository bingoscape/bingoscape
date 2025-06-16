/* eslint-disable */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, AlertTriangle, X, Upload, Clock, CheckCircle2, Link, Users } from "lucide-react"
import type { Tile, Team } from "@/app/actions/events"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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

interface SubmissionsTabProps {
  selectedTile: Tile | null
  currentTeamId: string | undefined
  teams: Team[]
  hasSufficientRights: boolean
  selectedImage: File | null
  pastedImage: File | null
  isSubmissionsLocked: boolean
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageSubmit: () => void
  onFullSizeImageView: (src: string, alt: string) => void
  onTeamTileSubmissionStatusUpdate: (
    teamTileSubmissionId: string | undefined,
    newStatus: "approved" | "needs_review",
  ) => void
  onSubmissionStatusUpdate: (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
  ) => void
  onDeleteSubmission: (submissionId: string) => void
}

export function SubmissionsTab({
  selectedTile,
  currentTeamId,
  teams,
  hasSufficientRights,
  selectedImage,
  pastedImage,
  isSubmissionsLocked,
  onImageChange,
  onImageSubmit,
  onFullSizeImageView,
  onTeamTileSubmissionStatusUpdate,
  onSubmissionStatusUpdate,
  onDeleteSubmission,
}: SubmissionsTabProps) {
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null)
  const [submissionForGoal, setSubmissionForGoal] = useState<string | null>(null)
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("pending")
  const [teamFilter, setTeamFilter] = useState<string>("all")

  // Local state to track real-time status changes
  const [localTileStatuses, setLocalTileStatuses] = useState<Record<string, "approved" | "needs_review" | "pending">>(
    {},
  )
  const [localSubmissionStatuses, setLocalSubmissionStatuses] = useState<
    Record<string, "approved" | "needs_review" | "pending">
  >({})

  // Add this effect to set the current goal when opening the dialog
  useEffect(() => {
    if (submissionForGoal) {
      // Find the current goal ID for this submission
      let currentGoalId = null
      selectedTile?.teamTileSubmissions?.forEach((teamSub) => {
        teamSub.submissions.forEach((sub) => {
          if (sub.id === submissionForGoal) {
            currentGoalId = sub.goalId || null
          }
        })
      })
      setSelectedGoalId(currentGoalId)
    }
  }, [submissionForGoal, selectedTile])

  const currentTeam = teams.find((team) => team.id === currentTeamId)
  const currentTeamSubmission = selectedTile?.teamTileSubmissions?.find((sub) => sub.teamId === currentTeamId)

  // If user is not part of a team and doesn't have sufficient rights, show empty state
  if (!hasSufficientRights && !currentTeamId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium text-muted-foreground mb-2">Join a Team to View Submissions</h3>
        <p className="text-sm text-muted-foreground max-w-md">
          You need to be part of a team to view and submit entries for this bingo tile. Contact an event organizer to
          join a team.
        </p>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="bg-green-500 text-white">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "needs_review":
        return (
          <Badge className="bg-yellow-500 text-white">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        )
      default:
        return (
          <Badge className="bg-blue-500 text-white">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        )
    }
  }

  const handleGoalAssignment = (submissionId: string, goalId: string | null) => {
    // Find the current status of the submission
    let currentStatus = "pending"
    selectedTile?.teamTileSubmissions?.forEach((teamSub) => {
      teamSub.submissions.forEach((sub) => {
        if (sub.id === submissionId) {
          currentStatus = localSubmissionStatuses[sub.id] || sub.status
        }
      })
    })

    onSubmissionStatusUpdate(submissionId, currentStatus as "pending" | "approved" | "needs_review", goalId)
    setSubmissionForGoal(null)
  }

  // Enhanced handlers with real-time updates
  const handleTeamTileSubmissionStatusUpdate = async (
    teamTileSubmissionId: string | undefined,
    newStatus: "approved" | "needs_review",
  ) => {
    if (!teamTileSubmissionId) return

    // Optimistically update local state
    setLocalTileStatuses((prev) => ({ ...prev, [teamTileSubmissionId]: newStatus }))

    // If approving the tile, also update all submissions in that tile
    if (newStatus === "approved") {
      const teamSubmission = selectedTile?.teamTileSubmissions?.find((ts) => ts.id === teamTileSubmissionId)
      if (teamSubmission) {
        const updatedSubmissionStatuses: Record<string, "approved"> = {}
        teamSubmission.submissions.forEach((sub) => {
          updatedSubmissionStatuses[sub.id] = "approved"
        })
        setLocalSubmissionStatuses((prev) => ({ ...prev, ...updatedSubmissionStatuses }))
      }
    }

    // Call the original handler
    onTeamTileSubmissionStatusUpdate(teamTileSubmissionId, newStatus)
  }

  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
  ) => {
    // Optimistically update local state
    setLocalSubmissionStatuses((prev) => ({ ...prev, [submissionId]: newStatus }))

    // If marking submission as needs_review, also update the parent tile
    if (newStatus === "needs_review") {
      // Find the parent tile submission
      selectedTile?.teamTileSubmissions?.forEach((teamSub) => {
        teamSub.submissions.forEach((sub) => {
          if (sub.id === submissionId) {
            setLocalTileStatuses((prev) => ({ ...prev, [teamSub.id]: "needs_review" }))
          }
        })
      })
    }

    // Call the original handler
    onSubmissionStatusUpdate(submissionId, newStatus, goalId)
  }

  // Helper function to get the current status (local override or original)
  const getTileStatus = (teamTileSubmissionId: string, originalStatus: string) => {
    return localTileStatuses[teamTileSubmissionId] || originalStatus
  }

  const getSubmissionStatus = (submissionId: string, originalStatus: string) => {
    return localSubmissionStatuses[submissionId] || originalStatus
  }

  // Filter submissions based on user role and selected filters
  const getFilteredSubmissions = () => {
    if (!selectedTile?.teamTileSubmissions) return []

    let submissions = selectedTile.teamTileSubmissions

    // If user is a normal participant, only show their team's submissions
    if (!hasSufficientRights && currentTeamId) {
      submissions = submissions.filter((teamSub) => teamSub.teamId === currentTeamId)
    }

    // Apply team filter (for admin/management users)
    if (hasSufficientRights && teamFilter !== "all") {
      submissions = submissions.filter((teamSub) => teamSub.teamId === teamFilter)
    }

    // Apply status filter
    if (statusFilter !== "all") {
      submissions = submissions.filter((teamSub) => {
        // Check team submission status (with local override)
        const currentTileStatus = getTileStatus(teamSub.id, teamSub.status)
        if (currentTileStatus === statusFilter) return true

        // Also check individual submission statuses (with local override)
        return teamSub.submissions.some((sub) => {
          const currentSubmissionStatus = getSubmissionStatus(sub.id, sub.status || "pending")
          return currentSubmissionStatus === statusFilter
        })
      })
    }

    return submissions
  }

  const filteredSubmissions = getFilteredSubmissions()

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4">
      <div className="space-y-6 p-4">
        {/* Current team submission form */}
        {currentTeamId && !isSubmissionsLocked && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Submit for {currentTeam?.name}</h3>
            <div className="space-y-3">
              <div>
                <Label htmlFor="image" className="block text-sm font-medium text-gray-700 mb-1">
                  Upload Image
                </Label>
                <div className="flex items-center gap-2">
                  <Input id="image" type="file" accept="image/*" onChange={onImageChange} className="flex-1" />
                  <Button onClick={onImageSubmit} disabled={!selectedImage && !pastedImage}>
                    <Upload className="h-4 w-4 mr-2" />
                    Submit
                  </Button>
                </div>
                {(selectedImage || pastedImage) && (
                  <div className="mt-2">
                    <p className="text-sm text-muted-foreground">
                      {selectedImage ? selectedImage.name : "Pasted image"} ready to submit
                    </p>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  You can also paste an image directly (Ctrl+V / Cmd+V)
                </p>
              </div>
            </div>
          </div>
        )}

        {isSubmissionsLocked && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-yellow-700">Submissions are currently locked for this bingo board.</p>
            </div>
          </div>
        )}

        {/* Filters - only show for admin/management */}
        {hasSufficientRights && (
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="font-medium">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="status-filter" className="block text-sm font-medium mb-1">
                  Status Filter
                </Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="needs_review">Needs Review</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="team-filter" className="block text-sm font-medium mb-1">
                  Team Filter
                </Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        {team.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Team submissions */}
        <div className="space-y-6">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((teamSubmission) => {
              const currentTileStatus = getTileStatus(teamSubmission.id, teamSubmission.status)

              return (
                <div key={teamSubmission.id} className="border rounded-lg overflow-hidden">
                  <div className="bg-muted/30 p-4">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{
                            backgroundColor: `hsl(${(teamSubmission.team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
                          }}
                        />
                        <h3 className="font-medium">{teamSubmission.team.name}</h3>
                        {getStatusBadge(currentTileStatus)}
                      </div>
                      {hasSufficientRights && (
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                            onClick={() => handleTeamTileSubmissionStatusUpdate(teamSubmission.id, "approved")}
                            disabled={currentTileStatus === "approved"}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                            onClick={() => handleTeamTileSubmissionStatusUpdate(teamSubmission.id, "needs_review")}
                            disabled={currentTileStatus === "needs_review"}
                          >
                            <AlertTriangle className="h-4 w-4 mr-1" />
                            Needs Review
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {teamSubmission.submissions.length > 0 ? (
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                      {teamSubmission.submissions
                        .filter((submission) => {
                          // Apply status filter to individual submissions (with local override)
                          if (statusFilter === "all") return true
                          const currentSubmissionStatus = getSubmissionStatus(
                            submission.id,
                            submission.status || "pending",
                          )
                          return currentSubmissionStatus === statusFilter
                        })
                        .map((submission) => {
                          const currentSubmissionStatus = getSubmissionStatus(
                            submission.id,
                            submission.status || "pending",
                          )

                          return (
                            <div key={submission.id} className="border rounded-md overflow-hidden">
                              <div className="relative aspect-video">
                                <Image
                                  src={submission.image.path || "/placeholder.svg"}
                                  alt={`Submission by ${submission.user.runescapeName || "Unknown"}`}
                                  fill
                                  className="object-cover cursor-pointer"
                                  onClick={() =>
                                    onFullSizeImageView(
                                      submission.image.path,
                                      `Submission by ${submission.user.runescapeName || "Unknown"}`,
                                    )
                                  }
                                />
                              </div>
                              <div className="p-3 space-y-2">
                                <div className="flex justify-between items-center">
                                  <div className="text-sm font-medium truncate">
                                    {submission.user.runescapeName || submission.user.name || "Unknown"}
                                  </div>
                                  {getStatusBadge(currentSubmissionStatus)}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {new Date(submission.createdAt).toLocaleString()}
                                </div>

                                {/* Goal assignment display - now editable */}
                                {submission.goalId ? (
                                  <div
                                    className="flex items-center justify-between gap-1 mt-1 bg-blue-50 p-1.5 rounded text-xs cursor-pointer hover:bg-blue-100"
                                    onClick={() => setSubmissionForGoal(submission.id)}
                                  >
                                    <div className="flex items-center gap-1 truncate">
                                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span className="text-blue-700 font-medium truncate">
                                        {selectedTile?.goals?.find((g) => g.id === submission.goalId)?.description ||
                                          "Goal"}
                                      </span>
                                    </div>
                                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                                      <Link className="h-3 w-3 text-blue-500" />
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full mt-1 h-7 text-xs"
                                    onClick={() => setSubmissionForGoal(submission.id)}
                                  >
                                    <Link className="h-3.5 w-3.5 mr-1" />
                                    Assign Goal
                                  </Button>
                                )}

                                {hasSufficientRights && (
                                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => handleSubmissionStatusUpdate(submission.id, "approved")}
                                            disabled={currentSubmissionStatus === "approved"}
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Approve Submission</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                            onClick={() => handleSubmissionStatusUpdate(submission.id, "needs_review")}
                                            disabled={currentSubmissionStatus === "needs_review"}
                                          >
                                            <AlertTriangle className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mark as Needs Review</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <AlertDialog
                                      open={submissionToDelete === submission.id}
                                      onOpenChange={(open) => !open && setSubmissionToDelete(null)}
                                    >
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => setSubmissionToDelete(submission.id)}
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>Delete Submission</TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete this submission? This action cannot be
                                            undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              onDeleteSubmission(submission.id)
                                              setSubmissionToDelete(null)
                                            }}
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
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">No submissions yet</div>
                  )}
                </div>
              )
            })
          ) : (
            <div className="text-center py-8 bg-muted/30 rounded-lg">
              <p className="text-muted-foreground">
                {statusFilter === "pending"
                  ? "No pending submissions for this tile yet."
                  : "No submissions match the current filters."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Goal Assignment Dialog */}
      <AlertDialog open={!!submissionForGoal} onOpenChange={(open) => !open && setSubmissionForGoal(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign Goal to Submission</AlertDialogTitle>
            <AlertDialogDescription>
              Select a goal to associate with this submission or select "No Goal" to remove the association.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select
              value={selectedGoalId || "none"}
              onValueChange={(value) => setSelectedGoalId(value === "none" ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a goal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Goal</SelectItem>
                {selectedTile?.goals?.map((goal) => (
                  <SelectItem key={goal.id} value={goal.id}>
                    {goal.description} (Target: {goal.targetValue})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => submissionForGoal && handleGoalAssignment(submissionForGoal, selectedGoalId)}
            >
              Assign Goal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
