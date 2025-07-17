/* eslint-disable */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Check, AlertTriangle, X, Upload, Clock, CheckCircle2, Link, Users, Hash, Search, Star, ChevronsUpDown } from "lucide-react"
import type { Tile, Team } from "@/app/actions/events"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command"
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
import { getGoalValues } from "@/app/actions/goals"
import { toast } from "@/hooks/use-toast"

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
    submissionValue?: number | null,
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

  const [goalValues, setGoalValues] = useState<any[]>([])
  const [selectedSubmissionValue, setSelectedSubmissionValue] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [dropdownOpen, setDropdownOpen] = useState(false)

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

  useEffect(() => {
    if (selectedGoalId && selectedGoalId !== "none") {
      getGoalValues(selectedGoalId).then(setGoalValues)
      // Set default value to 1 if no custom value is already set
      if (!customValue && selectedSubmissionValue === null) {
        setSelectedSubmissionValue(1)
      }
    } else {
      setGoalValues([])
      // Reset values when no goal is selected
      setSelectedSubmissionValue(null)
      setCustomValue("")
    }
  }, [selectedGoalId])

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
          <Badge className="bg-green-100 text-green-800 border-green-200 px-3 py-1">
            <Check className="h-3 w-3 mr-1" />
            Approved
          </Badge>
        )
      case "needs_review":
        return (
          <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200 px-3 py-1">
            <AlertTriangle className="h-3 w-3 mr-1" />
            Needs Review
          </Badge>
        )
      default:
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 px-3 py-1">
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

    // Determine the final value to use
    let finalValue = selectedSubmissionValue
    if (customValue && !isNaN(Number.parseFloat(customValue))) {
      finalValue = Number.parseFloat(customValue)
    }

    // Enhanced validation with user feedback
    if (goalId && goalId !== "none") {
      if (finalValue === null || finalValue === undefined) {
        toast({
          title: "Value Required",
          description: "Please select a predefined value or enter a custom value for this goal.",
          variant: "destructive",
        })
        return
      }

      if (finalValue <= 0) {
        toast({
          title: "Invalid Value",
          description: "The submission value must be greater than 0.",
          variant: "destructive",
        })
        return
      }

      // Check if the value exceeds the goal's target (warning, not blocking)
      const selectedGoal = selectedTile?.goals?.find(g => g.id === goalId)
      if (selectedGoal && finalValue > selectedGoal.targetValue) {
        // Allow but warn
        toast({
          title: "Value Exceeds Target",
          description: `The value ${finalValue} exceeds the goal target of ${selectedGoal.targetValue}. This is allowed but may indicate an error.`,
          variant: "default",
        })
      }
    }

    try {
      onSubmissionStatusUpdate(submissionId, currentStatus as "pending" | "approved" | "needs_review", goalId, finalValue)

      // Success feedback
      const goalDescription = goalId ? selectedTile?.goals?.find(g => g.id === goalId)?.description : null
      const message = goalId
        ? `Goal "${goalDescription}" assigned with value ${finalValue}`
        : "Goal assignment removed from submission"

      toast({
        title: "Goal Assignment Updated",
        description: message,
      })

      // Reset form state
      setSubmissionForGoal(null)
      setSelectedSubmissionValue(null)
      setCustomValue("")
      setSearchTerm("")
    } catch (error) {
      toast({
        title: "Assignment Failed",
        description: "Failed to assign goal to submission. Please try again.",
        variant: "destructive",
      })
    }
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
    submissionValue?: number | null,
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
    onSubmissionStatusUpdate(submissionId, newStatus, goalId, submissionValue)
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
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-4 bg-background text-foreground">
      <div className="space-y-6 p-4">
        {/* Current team submission form */}
        {currentTeamId && !isSubmissionsLocked && (
          <div className="border border-border rounded-lg p-6 space-y-4 bg-card shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div
                className="h-3 w-3 rounded-full"
                style={{
                  backgroundColor: `hsl(${(currentTeam?.name?.charCodeAt(0) || 0) * 10 % 360}, 70%, 50%)`,
                }}
              />
              <h3 className="font-semibold text-lg text-foreground">Submit for {currentTeam?.name}</h3>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="image" className="block text-sm font-medium text-muted-foreground mb-2">
                  Upload Image
                </Label>

                {/* Enhanced drag-and-drop upload area */}
                <div className="relative">
                  <div className="border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-muted-foreground transition-colors bg-muted/20 upload-area">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="p-4 bg-blue-500/20 rounded-full">
                        <Upload className="h-8 w-8 text-blue-500" />
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-foreground">
                          Drag and drop your image here, or click to browse
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PNG, JPG, GIF up to 10MB
                        </p>
                      </div>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={onImageChange}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Image preview */}
                  {(selectedImage || pastedImage) && (
                    <div className="mt-4 p-4 bg-green-500/20 border border-green-500 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-500/30 rounded-full">
                          <CheckCircle2 className="h-5 w-5 text-green-500" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-500">
                            Image ready to submit
                          </p>
                          <p className="text-xs text-green-500/80">
                            {selectedImage ? selectedImage.name : "Pasted image"}
                          </p>
                        </div>
                        <Button
                          onClick={onImageSubmit}
                          className="bg-green-500 hover:bg-green-600 text-foreground"
                          size="sm"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Submit
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">Ctrl</kbd>
                    <span>+</span>
                    <kbd className="px-2 py-1 bg-muted rounded text-xs text-foreground">V</kbd>
                  </div>
                  <span>to paste an image directly</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {isSubmissionsLocked && (
          <div className="bg-yellow-500/20 border border-yellow-500 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-yellow-500">Submissions are currently locked for this bingo board.</p>
            </div>
          </div>
        )}

        {/* Enhanced Filters */}
        <div className="border border-border rounded-lg p-6 space-y-4 bg-card shadow-sm">
          <h3 className="font-semibold text-lg text-foreground">Filters</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label htmlFor="status-filter" className="block text-sm font-medium mb-2 text-muted-foreground">
                Status Filter
              </Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-gray-400" />
                      All Statuses
                    </div>
                  </SelectItem>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      Pending
                    </div>
                  </SelectItem>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Approved
                    </div>
                  </SelectItem>
                  <SelectItem value="needs_review">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                      Needs Review
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {hasSufficientRights && (
              <div>
                <Label htmlFor="team-filter" className="block text-sm font-medium mb-2 text-muted-foreground">
                  Team Filter
                </Label>
                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Filter by team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        All Teams
                      </div>
                    </SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2 w-2 rounded-full"
                            style={{
                              backgroundColor: `hsl(${(team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
                            }}
                          />
                          {team.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        {/* Team submissions */}
        <div className="space-y-6">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((teamSubmission) => {
              const currentTileStatus = getTileStatus(teamSubmission.id, teamSubmission.status)

              return (
                <div key={teamSubmission.id} className="border border-border rounded-lg overflow-hidden shadow-sm bg-card">
                  <div className="bg-muted/30 p-4 border-b border-border">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full shadow-sm"
                          style={{
                            backgroundColor: `hsl(${(teamSubmission.team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
                          }}
                        />
                        <h3 className="font-semibold text-foreground">{teamSubmission.team.name}</h3>
                        {getStatusBadge(currentTileStatus)}
                      </div>
                      {hasSufficientRights && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-green-600 hover:text-green-700 hover:bg-green-50 border-green-200"
                            onClick={() => handleTeamTileSubmissionStatusUpdate(teamSubmission.id, "approved")}
                            disabled={currentTileStatus === "approved"}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 border-yellow-200"
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
                    <div className="p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 submission-grid">
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
                            <div key={submission.id} className="border border-border rounded-md overflow-hidden shadow-sm bg-card hover:shadow-md transition-shadow">
                              <div className="relative aspect-video">
                                <Image
                                  src={submission.image.path || "/placeholder.svg"}
                                  alt={`Submission by ${submission.user.runescapeName || "Unknown"}`}
                                  fill
                                  className="object-cover cursor-pointer hover:opacity-90 transition-opacity"
                                  onClick={() =>
                                    onFullSizeImageView(
                                      submission.image.path,
                                      `Submission by ${submission.user.runescapeName || "Unknown"}`,
                                    )
                                  }
                                />
                                {/* Status overlay */}
                                <div className="absolute top-2 right-2">
                                  {getStatusBadge(currentSubmissionStatus)}
                                </div>
                              </div>
                              <div className="p-3 space-y-3">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <div className="text-sm font-medium text-foreground truncate">
                                      {submission.user.runescapeName || submission.user.name || "Unknown"}
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">
                                      {new Date(submission.createdAt).toLocaleString()}
                                    </div>
                                  </div>
                                </div>

                                {/* Goal assignment and value display */}
                                <div className="flex flex-wrap gap-1">
                                  {submission.goalId ? (
                                    <div
                                      className={`flex items-center gap-1 bg-blue-500/20 p-1.5 rounded text-xs ${hasSufficientRights ? "cursor-pointer hover:bg-[#3B82F6]/30" : ""
                                        }`}
                                      onClick={
                                        hasSufficientRights ? () => setSubmissionForGoal(submission.id) : undefined
                                      }
                                    >
                                      <CheckCircle2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                                      <span className="text-blue-500 font-medium truncate">
                                        {selectedTile?.goals?.find((g) => g.id === submission.goalId)?.description ||
                                          "Goal"}
                                      </span>
                                      {hasSufficientRights && <Link className="h-3 w-3 text-blue-500 ml-1" />}
                                    </div>
                                  ) : (
                                    hasSufficientRights && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-7 text-xs bg-transparent"
                                        onClick={() => setSubmissionForGoal(submission.id)}
                                      >
                                        <Link className="h-3.5 w-3.5 mr-1" />
                                        Assign Goal
                                      </Button>
                                    )
                                  )}
                                  {/* Submission Value Badge with Tooltip */}
                                  {submission.submissionValue !== null && submission.submissionValue !== undefined && (
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Badge variant="secondary" className="text-xs">
                                            <Hash className="h-3 w-3 mr-1" />
                                            {submission.submissionValue}
                                          </Badge>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p>Submission Value: {submission.submissionValue}</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  )}
                                </div>

                                {hasSufficientRights && (
                                  <div className="flex justify-end gap-1 mt-2 pt-2 border-t border-border">
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

      {/* Enhanced Goal Assignment Dialog - Only for users with sufficient rights */}
      {hasSufficientRights && (
        <AlertDialog open={!!submissionForGoal} onOpenChange={(open) => {
          if (!open) {
            setSubmissionForGoal(null)
            setSearchTerm("")
            setDropdownOpen(false)
          }
        }}>
          <AlertDialogContent className="max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col bg-background border-border">
            <AlertDialogHeader className="pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-full">
                  <Link className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <AlertDialogTitle className="text-xl font-semibold text-foreground">
                    Assign Goal to Submission
                  </AlertDialogTitle>
                  <AlertDialogDescription className="text-sm text-muted-foreground mt-1">
                    Link this submission to a specific goal and set its contribution value.
                  </AlertDialogDescription>
                </div>
              </div>
            </AlertDialogHeader>

            <div className="flex-1 overflow-y-auto py-6 space-y-6">
              {/* Goal Selection Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-yellow-500" />
                  <Label className="text-sm font-semibold text-foreground">Select Goal</Label>
                </div>
                <Select
                  value={selectedGoalId || "none"}
                  onValueChange={(value) => {
                    setSelectedGoalId(value === "none" ? null : value)
                    setSearchTerm("")
                    setSelectedSubmissionValue(null)
                    setCustomValue("")
                    setDropdownOpen(false)
                  }}
                >
                  <SelectTrigger className="w-full h-12 bg-muted/30 border-border hover:bg-muted/50 transition-colors">
                    <SelectValue placeholder="Choose a goal for this submission" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none" className="text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <X className="h-4 w-4" />
                        No Goal
                      </div>
                    </SelectItem>
                    {selectedTile?.goals?.map((goal) => (
                      <SelectItem key={goal.id} value={goal.id}>
                        <div className="flex items-center justify-between w-full">
                          <span className="font-medium">{goal.description}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            Target: {goal.targetValue}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value Selection Section - Enhanced with searchable dropdown */}
              {selectedGoalId && selectedGoalId !== "none" && (
                <div className="space-y-4 p-4 bg-muted/20 rounded-lg border border-border">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-green-500" />
                    <Label className="text-sm font-semibold text-foreground">Submission Value *</Label>
                    <div className="ml-auto">
                      <span className="text-xs bg-red-500/20 text-red-500 px-2 py-1 rounded-full font-medium">
                        Required
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Specify how much this submission contributes towards the goal target.
                  </p>

                  {/* Searchable Predefined Values Dropdown */}
                  {goalValues.length > 0 && (
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-foreground">Predefined Values</Label>

                      <Select
                        value={selectedSubmissionValue?.toString() || ""}
                        onValueChange={(value) => {
                          if (value) {
                            setSelectedSubmissionValue(Number.parseFloat(value))
                            setCustomValue("")
                          }
                        }}
                      >
                        <SelectTrigger className="w-full h-12 bg-background border-border hover:bg-muted/50">
                          <SelectValue placeholder="Select a predefined value..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {goalValues.map((gv) => (
                            <SelectItem key={gv.id} value={gv.value.toString()}>
                              <div className="flex items-center gap-3 w-full">
                                <div className="px-2 py-1 bg-blue-500/20 rounded text-xs font-mono font-medium text-blue-500 min-w-[50px] text-center">
                                  {gv.value}
                                </div>
                                <div className="flex-1 text-left">
                                  <div className="font-medium text-sm">{gv.description}</div>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Custom Value Section */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="customValue" className="text-sm font-medium text-foreground">
                        Custom Value
                      </Label>
                      {selectedSubmissionValue !== null && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSubmissionValue(null)
                            setCustomValue("")
                          }}
                          className="text-xs text-muted-foreground hover:text-foreground"
                        >
                          Clear selection
                        </Button>
                      )}
                    </div>
                    <Input
                      id="customValue"
                      type="number"
                      step="0.1"
                      min="0"
                      value={customValue}
                      onChange={(e) => {
                        setCustomValue(e.target.value)
                        setSelectedSubmissionValue(null)
                      }}
                      placeholder="Enter a custom value (e.g., 1.5, 2, 0.5)"
                      className="h-12 bg-background border-border"
                      disabled={selectedSubmissionValue !== null}
                    />
                    <p className="text-xs text-muted-foreground">
                      Enter a custom numeric value if none of the predefined options fit your needs.
                    </p>
                  </div>

                  {/* Value Preview */}
                  {(selectedSubmissionValue !== null || customValue) && (
                    <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <span className="text-sm font-medium text-green-500">
                          Value set to: {selectedSubmissionValue !== null ? selectedSubmissionValue : parseFloat(customValue) || 0}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <AlertDialogFooter className="border-t border-border pt-4">
              <AlertDialogCancel className="mr-auto">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => submissionForGoal && handleGoalAssignment(submissionForGoal, selectedGoalId)}
                disabled={!!(selectedGoalId && selectedGoalId !== "none" && !selectedSubmissionValue && !customValue)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-6"
              >
                <Link className="h-4 w-4 mr-2" />
                Assign Goal
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )
      }
    </div >
  )
}
