/* eslint-disable */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, AlertTriangle, X, Upload, Clock, CheckCircle2, Link } from "lucide-react"
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
          currentStatus = sub.status
        }
      })
    })

    onSubmissionStatusUpdate(submissionId, currentStatus as "pending" | "approved" | "needs_review", goalId)
    setSubmissionForGoal(null)
  }

  return (
    <div className="p-4 space-y-6">
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
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
            <p className="text-yellow-700">Submissions are currently locked for this bingo board.</p>
          </div>
        </div>
      )}

      {/* Team submissions */}
      <div className="space-y-6">
        {selectedTile?.teamTileSubmissions && selectedTile.teamTileSubmissions.length > 0 ? (
          selectedTile.teamTileSubmissions.map((teamSubmission) => (
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
                    {getStatusBadge(teamSubmission.status)}
                  </div>
                  {hasSufficientRights && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50"
                        onClick={() => onTeamTileSubmissionStatusUpdate(teamSubmission.id, "approved")}
                        disabled={teamSubmission.status === "approved"}
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                        onClick={() => onTeamTileSubmissionStatusUpdate(teamSubmission.id, "needs_review")}
                        disabled={teamSubmission.status === "needs_review"}
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
                  {teamSubmission.submissions.map((submission) => (
                    <div key={submission.id} className="border rounded-md overflow-hidden">
                      <div className="relative aspect-video">
                        <Image
                          src={submission.image.path || "/placeholder.svg"}
                          alt={`Submission by ${submission.user.name || "Unknown"}`}
                          fill
                          className="object-cover cursor-pointer"
                          onClick={() =>
                            onFullSizeImageView(
                              submission.image.path,
                              `Submission by ${submission.user.name || "Unknown"}`,
                            )
                          }
                        />
                      </div>
                      <div className="p-3 space-y-2">
                        <div className="flex justify-between items-center">
                          <div className="text-sm font-medium truncate">
                            {submission.user.name || submission.user.runescapeName || "Unknown"}
                          </div>
                          {getStatusBadge(submission.status || "pending")}
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
                                {selectedTile.goals?.find((g) => g.id === submission.goalId)?.description || "Goal"}
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
                                    onClick={() => onSubmissionStatusUpdate(submission.id, "approved")}
                                    disabled={submission.status === "approved"}
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
                                    onClick={() => onSubmissionStatusUpdate(submission.id, "needs_review")}
                                    disabled={submission.status === "needs_review"}
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
                                    Are you sure you want to delete this submission? This action cannot be undone.
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
                  ))}
                </div>
              ) : (
                <div className="p-4 text-center text-muted-foreground">No submissions yet</div>
              )}
            </div>
          ))
        ) : (
          <div className="text-center py-8 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground">No submissions for this tile yet.</p>
          </div>
        )}
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
