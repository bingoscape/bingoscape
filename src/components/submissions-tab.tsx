/* eslint-disable */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import {
  Check,
  AlertTriangle,
  X,
  Clock,
  Users,
  Zap,
  User,
  Filter,
} from "lucide-react"


import { CommentForm } from "@/components/comment-form"
import { SubmissionCommentDisplay } from "@/components/submission-comment"
import { SubmissionUploadForm } from "@/components/submission-upload-form"
import { getOptimizedImageUrl } from "@/lib/utils"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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

import { InlineGoalAssignment } from "@/components/inline-goal-assignment"
import { toast } from "@/hooks/use-toast"
import type { Tile, Team, SubmissionComment, SelectableUser } from "@/types/model"

interface SubmissionsTabProps {
  selectedTile: Tile | null
  currentTeamId: string | undefined
  teams: Team[]
  hasSufficientRights: boolean
  selectedImage: File | null
  pastedImage: File | null
  isSubmissionsLocked: boolean
  isUploadingImage: boolean
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  onImageSubmit: (onBehalfOfUserId?: string) => void
  onFullSizeImageView: (src: string, alt: string) => void
  onTeamTileSubmissionStatusUpdate: (
    teamTileSubmissionId: string | undefined,
    newStatus: "completed" | "needs_attention"
  ) => void
  onSubmissionStatusUpdate: (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null
  ) => void
  onDeleteSubmission: (submissionId: string) => void
  // New props for submitting on behalf of another user
  selectableUsers?: SelectableUser[]
  selectedUserId?: string
  onUserSelect?: (userId: string) => void
  teamTileSubmissions: any[] // Updated from selectedTile
  isAdminView?: boolean
}

export function SubmissionsTab({
  selectedTile,
  currentTeamId,
  teams,
  hasSufficientRights,
  selectedImage,
  pastedImage,
  isSubmissionsLocked,
  isUploadingImage,
  onImageChange,
  onImageSubmit,
  onFullSizeImageView,
  onTeamTileSubmissionStatusUpdate,
  onSubmissionStatusUpdate,
  onDeleteSubmission,
  selectableUsers,
  selectedUserId,
  onUserSelect,
  teamTileSubmissions,
  isAdminView,
}: SubmissionsTabProps) {

  const [goalValuesCache, _] = useState<Record<string, any[]>>(
    {}
  )

  // Filter out unassigned users before passing to child components
  const assignedUsers =
    selectableUsers?.filter(
      (user) => user.teamName !== undefined && user.teamName !== null
    ) ?? []
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(
    null
  )
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [teamFilter, setTeamFilter] = useState<string>("all")

  // Filter state
  const [boardFilter, setBoardFilter] = useState<string>("all")
  const [tileFilter, setTileFilter] = useState<string>("all")
  const [isFiltersOpen, setIsFiltersOpen] = useState(false)

  // Triage Inbox State
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)

  // Local state to track real-time status changes
  const [localTileStatuses, setLocalTileStatuses] = useState<
    Record<string, "incomplete" | "completed" | "needs_attention">
  >({})
  const [localSubmissionStatuses, setLocalSubmissionStatuses] = useState<
    Record<string, "approved" | "needs_review" | "pending">
  >({})
  const [localGoals, setLocalGoals] = useState<Record<string, string | null>>({})
  const [localValues, setLocalValues] = useState<Record<string, number | null>>({})

  // Comment-related state
  const [submissionComments, setSubmissionComments] = useState<
    Record<string, SubmissionComment[]>
  >({})
  const [showCommentForm, setShowCommentForm] = useState<string | null>(null)
  const [isSubmittingComment, setIsSubmittingComment] = useState(false)



  const handleInlineGoalAssignment = (
    submissionId: string,
    goalId: string | null,
    value: number | null
  ) => {
    const allSubmissions = teamTileSubmissions ? teamTileSubmissions.flatMap(t => t.submissions || []) : []
    const submission = allSubmissions.find((s: any) => s.id === submissionId)
    const currentStatus = getSubmissionStatus(submissionId, submission?.status || "pending")
    
    // Optimistically update local state so the UI reflects the removal (or change) immediately
    setLocalGoals((prev) => ({ ...prev, [submissionId]: goalId }))
    setLocalValues((prev) => ({ ...prev, [submissionId]: value }))
    
    onSubmissionStatusUpdate(submissionId, currentStatus as any, goalId, value)
  }

  const currentTeam = teams.find((team) => team.id === currentTeamId)
  
  // If user is not part of a team and doesn't have sufficient rights, show empty state
  if (!hasSufficientRights && !currentTeamId) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <Users className="mb-4 h-12 w-12 text-muted-foreground" />
        <h3 className="mb-2 text-lg font-medium text-muted-foreground">
          Join a Team to View Submissions
        </h3>
        <p className="max-w-md text-sm text-muted-foreground">
          You need to be part of a team to view and submit entries for this
          bingo tile. Contact an event organizer to join a team.
        </p>
      </div>
    )
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="border-green-200 bg-green-100 px-3 py-1 text-green-800">
            <Check className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        )
      case "needs_review":
        return (
          <Badge className="border-yellow-200 bg-yellow-100 px-3 py-1 text-yellow-800">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Changes Requested
          </Badge>
        )
      default:
        return (
          <Badge className="border-blue-200 bg-blue-100 px-3 py-1 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        )
    }
  }

  // Enhanced handlers with real-time updates
  const handleTeamTileSubmissionStatusUpdate = async (
    teamTileSubmissionId: string | undefined,
    newStatus: "completed" | "needs_attention"
  ) => {
    if (!teamTileSubmissionId) return

    // Optimistically update local state
    setLocalTileStatuses((prev) => ({
      ...prev,
      [teamTileSubmissionId]: newStatus,
    }))

    // If approving the tile, also update all submissions in that tile
    if (newStatus === "completed") {
      const teamSubmission = teamTileSubmissions?.find(
        (ts) => ts.id === teamTileSubmissionId
      )
      if (teamSubmission) {
        const updatedSubmissionStatuses: Record<string, "approved"> = {}
        teamSubmission.submissions.forEach((sub: any) => {
          updatedSubmissionStatuses[sub.id] = "approved"
        })
        setLocalSubmissionStatuses((prev) => ({
          ...prev,
          ...updatedSubmissionStatuses,
        }))
      }
    }

    // Call the original handler
    onTeamTileSubmissionStatusUpdate(teamTileSubmissionId, newStatus)
    
    if (newStatus === "completed") {
      toast({
        title: "Tile Approved",
        description: "The tile and all its submissions have been approved.",
        duration: 3000,
        className: "bg-green-50 border-green-200 text-green-900",
      })
    }
  }

  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null
  ) => {
    // Optimistically update local state
    setLocalSubmissionStatuses((prev) => ({
      ...prev,
      [submissionId]: newStatus,
    }))

    if (goalId !== undefined) {
      setLocalGoals((prev) => ({ ...prev, [submissionId]: goalId }))
    }
    if (submissionValue !== undefined) {
      setLocalValues((prev) => ({ ...prev, [submissionId]: submissionValue }))
    }

    // If marking submission as needs_review, also update the parent tile
    if (newStatus === "needs_review") {
      // Find the parent tile submission
      teamTileSubmissions?.forEach((teamSub) => {
        teamSub.submissions.forEach((sub: any) => {
          if (sub.id === submissionId) {
            setLocalTileStatuses((prev) => ({
              ...prev,
              [teamSub.id]: "needs_review",
            }))
          }
        })
      })
    }

    // Auto-advance selection for power users if status changes
    if (hasSufficientRights && selectedSubmissionId === submissionId) {
      const currentIndex = filteredFlatSubmissions.findIndex((s: any) => s.id === submissionId)
      if (currentIndex !== -1 && currentIndex < filteredFlatSubmissions.length - 1) {
        setSelectedSubmissionId(filteredFlatSubmissions[currentIndex + 1].id)
      }
    }

    // Call the original handler
    onSubmissionStatusUpdate(submissionId, newStatus, goalId, submissionValue)

    if (newStatus === "approved") {
      toast({
        title: "Submission Approved",
        description: "The submission has been successfully approved.",
        duration: 3000,
        className: "bg-green-50 border-green-200 text-green-900",
      })
    }
  }

  // Helper function to get the current status (local override or original)
  const getTileStatus = (
    teamTileSubmissionId: string,
    originalStatus: string
  ) => {
    return localTileStatuses[teamTileSubmissionId] || originalStatus
  }

  const getSubmissionStatus = (
    submissionId: string,
    originalStatus: string
  ) => {
    return localSubmissionStatuses[submissionId] || originalStatus
  }

  const getSubmissionGoal = (
    submissionId: string,
    originalGoal: string | null
  ) => {
    return submissionId in localGoals ? localGoals[submissionId] : originalGoal
  }

  const getSubmissionValue = (
    submissionId: string,
    originalValue: number | null
  ) => {
    return submissionId in localValues ? localValues[submissionId] : originalValue
  }

  // Comment-related functions
  const loadSubmissionComments = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/comments`)
      if (response.ok) {
        const comments = await response.json()
        setSubmissionComments((prev) => ({
          ...prev,
          [submissionId]: comments,
        }))
      }
    } catch (error) {
      console.error("Failed to load comments:", error)
    }
  }

  const handleNeedsReviewClick = (submissionId: string) => {
    // Only allow reviewers (those with sufficient rights) to add comments
    if (!hasSufficientRights) return

    const currentStatus = getSubmissionStatus(
      submissionId,
      teamTileSubmissions
        ?.find((teamSub) =>
          teamSub.submissions.some((sub: any) => sub.id === submissionId)
        )
        ?.submissions.find((sub: any) => sub.id === submissionId)?.status ||
        "pending"
    )

    if (currentStatus === "needs_review") return

    // Load existing comments if not already loaded
    if (!submissionComments[submissionId]) {
      loadSubmissionComments(submissionId)
    }

    setShowCommentForm(submissionId)
  }

  const handleCommentSubmit = async (submissionId: string, comment: string) => {
    setIsSubmittingComment(true)
    try {
      // Update status with comment
      await handleSubmissionStatusUpdate(submissionId, "needs_review")

      // Add comment via API
      const response = await fetch(
        `/api/submissions/${submissionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        }
      )

      if (response.ok) {
        const newComment = await response.json()
        setSubmissionComments((prev) => ({
          ...prev,
          [submissionId]: [newComment, ...(prev[submissionId] || [])],
        }))

        toast({
          title: "Review comment added",
          description: "Submission marked as needs review with comment.",
          duration: 3000,
        })
      }
    } catch (error) {
      console.error("Failed to submit comment:", error)
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
        duration: 3000,
      })
    } finally {
      setIsSubmittingComment(false)
      setShowCommentForm(null)
    }
  }

  const handleCommentCancel = () => {
    setShowCommentForm(null)
  }

  // Load comments for submissions that have "needs_review" status
  useEffect(() => {
    if (teamTileSubmissions) {
      teamTileSubmissions.forEach((teamSub) => {
        teamSub.submissions.forEach((submission: any) => {
          if (
            submission.status === "needs_review" &&
            !submissionComments[submission.id]
          ) {
            loadSubmissionComments(submission.id)
          }
        })
      })
    }
  }, [teamTileSubmissions, submissionComments])

  // Flatten submissions
  const allFlatSubmissions = teamTileSubmissions ? teamTileSubmissions.flatMap(ts => 
    ts.submissions.map((sub: any) => ({
      ...sub,
      teamTileSubmissionId: ts.id,
      team: ts.team,
      tile: ts.tile,
      parentStatus: ts.status
    }))
  ) : []

  // Filter submissions based on user role and selected filters
  const getFilteredFlatSubmissions = () => {
    let submissions = allFlatSubmissions

    // If user is a normal participant, only show their team's submissions
    if (!hasSufficientRights && currentTeamId) {
      submissions = submissions.filter((sub: any) => sub.team.id === currentTeamId)
    }

    // Apply team filter (for admin/management users)
    if (hasSufficientRights && teamFilter !== "all") {
      submissions = submissions.filter((sub: any) => sub.team.id === teamFilter)
    }

    // Apply Board filter
    if (boardFilter !== "all") {
      submissions = submissions.filter(
        (sub: any) => sub.tile?.bingo?.id === boardFilter || sub.tile?.bingoId === boardFilter
      )
    }

    // Apply Tile filter
    if (tileFilter !== "all") {
      submissions = submissions.filter(
        (sub: any) => sub.tile?.id === tileFilter || sub.tileId === tileFilter
      )
    }

    // Apply status filter
    if (statusFilter !== "all") {
      submissions = submissions.filter((sub: any) => {
        const currentSubmissionStatus = getSubmissionStatus(sub.id, sub.status || "pending")
        return currentSubmissionStatus === statusFilter
      })
    }

    // Sort
    return submissions.sort((a: any, b: any) => {
      const statusOrder: Record<string, number> = { needs_review: 0, pending: 1, approved: 2 }
      const statusA = getSubmissionStatus(a.id, a.status || "pending")
      const statusB = getSubmissionStatus(b.id, b.status || "pending")
      const valA = statusOrder[statusA] ?? 3
      const valB = statusOrder[statusB] ?? 3
      if (valA !== valB) return valA - valB
      // Sort by creation date descending if statuses are the same
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    })
  }

  const filteredFlatSubmissions = getFilteredFlatSubmissions()

  // Select first item by default if nothing is selected
  useEffect(() => {
    if (hasSufficientRights && filteredFlatSubmissions.length > 0 && (!selectedSubmissionId || !filteredFlatSubmissions.find((s: any) => s.id === selectedSubmissionId))) {
      setSelectedSubmissionId(filteredFlatSubmissions[0].id)
    }
  }, [filteredFlatSubmissions, hasSufficientRights, selectedSubmissionId])

  // Keyboard navigation
  useEffect(() => {
    if (!hasSufficientRights || filteredFlatSubmissions.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts if user is typing in an input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const currentIndex = filteredFlatSubmissions.findIndex((s: any) => s.id === selectedSubmissionId)
      
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (currentIndex < filteredFlatSubmissions.length - 1) {
          setSelectedSubmissionId(filteredFlatSubmissions[currentIndex + 1].id)
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (currentIndex > 0) {
          setSelectedSubmissionId(filteredFlatSubmissions[currentIndex - 1].id)
        }
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        // Find the combobox input and focus it
        const inputs = document.querySelectorAll('input[role="combobox"]')
        if (inputs.length > 0) {
          ;(inputs[inputs.length - 1] as HTMLInputElement).focus()
        }
      } else if (e.key === 'A' && e.shiftKey) {
        e.preventDefault()
        if (selectedSubmissionId) {
           const sub = filteredFlatSubmissions.find((s: any) => s.id === selectedSubmissionId)
           if (sub) {
             const currentStatus = getSubmissionStatus(sub.id, sub.status || "pending")
             if (currentStatus !== "approved") {
               handleSubmissionStatusUpdate(selectedSubmissionId, "approved")
             }
           }
        }
      } else if (e.key === 'R' && e.shiftKey) {
        e.preventDefault()
        if (selectedSubmissionId) {
           const sub = filteredFlatSubmissions.find((s: any) => s.id === selectedSubmissionId)
           if (sub) {
             const currentStatus = getSubmissionStatus(sub.id, sub.status || "pending")
             if (currentStatus !== "needs_review") {
               handleNeedsReviewClick(selectedSubmissionId)
             }
           }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasSufficientRights, filteredFlatSubmissions, selectedSubmissionId, localSubmissionStatuses])

  // Calculate submission counts by status
  const counts = {
    all: 0,
    needs_review: 0,
    pending: 0,
    approved: 0
  }
  
  if (teamTileSubmissions) {
    let baseSubmissions = teamTileSubmissions
    if (!hasSufficientRights && currentTeamId) {
      baseSubmissions = baseSubmissions.filter((ts) => ts.teamId === currentTeamId)
    }
    if (hasSufficientRights && teamFilter !== "all") {
      baseSubmissions = baseSubmissions.filter((ts) => ts.teamId === teamFilter)
    }
    if (boardFilter !== "all") {
      baseSubmissions = baseSubmissions.filter(
        (ts) => ts.tile?.bingo?.id === boardFilter || ts.tile?.bingoId === boardFilter
      )
    }
    if (tileFilter !== "all") {
      baseSubmissions = baseSubmissions.filter(
        (ts) => ts.tile?.id === tileFilter || ts.tileId === tileFilter
      )
    }
    
    // Each individual submission adds to the count
    baseSubmissions.forEach(ts => {
      ts.submissions.forEach((sub: any) => {
        counts.all++
        const status = getSubmissionStatus(sub.id, sub.status || "pending")
        if (status === "needs_review") counts.needs_review++
        else if (status === "pending") counts.pending++
        else if (status === "approved") counts.approved++
      })
    })
  }

  const isMetricOnly = selectedTile?.goals?.length
    ? selectedTile.goals.every((g: any) => g.goalType === "metric")
    : false

  // Extract unique boards and tiles for filters
  const uniqueBoards = Array.from(
    new Set(teamTileSubmissions.map((ts) => ts.tile?.bingo?.id).filter(Boolean))
  ).map((id) => {
    return teamTileSubmissions.find((ts) => ts.tile?.bingo?.id === id)?.tile
      ?.bingo
  })

  const uniqueTiles = Array.from(
    new Set(teamTileSubmissions.map((ts) => ts.tile?.id).filter(Boolean))
  ).map((id) => {
    return teamTileSubmissions.find((ts) => ts.tile?.id === id)?.tile
  })

  return (
    <div className="max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground">
      <div className="space-y-6 p-4">
        {/* Current team submission form */}
        {!isAdminView && currentTeamId && !isSubmissionsLocked && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-xs">
            <SubmissionUploadForm
              teamName={currentTeam?.name || "Your Team"}
              selectedImage={selectedImage}
              pastedImage={pastedImage}
              isUploading={isUploadingImage}
              onImageChange={onImageChange}
              onSubmit={() => onImageSubmit(selectedUserId)}
              showTeamHeader={true}
              selectableUsers={assignedUsers}
              selectedUserId={selectedUserId}
              onUserSelect={onUserSelect}
              isMetricOnly={isMetricOnly}
            />
          </div>
        )}

        {isSubmissionsLocked && (
          <div className="rounded-lg border border-yellow-500 bg-yellow-500/20 p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <p className="text-yellow-500">
                Submissions are currently locked for this bingo board.
              </p>
            </div>
          </div>
        )}

        {/* Enhanced Filters */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={statusFilter} onValueChange={setStatusFilter} className="w-full">
              <div className="flex items-center justify-between">
                <TabsList className="h-9 sm:h-10">
                  <TabsTrigger value="all" className="flex items-center gap-1.5 px-3">
                    All <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{counts.all}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="needs_review" className="flex items-center gap-1.5 px-3">
                    <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
                    <span className="hidden sm:inline">Changes Requested</span>
                    <span className="sm:hidden">Changes</span>
                    <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{counts.needs_review}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="pending" className="flex items-center gap-1.5 px-3">
                    <Clock className="h-3.5 w-3.5 text-blue-500" />
                    Pending <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{counts.pending}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="approved" className="flex items-center gap-1.5 px-3">
                    <Check className="h-3.5 w-3.5 text-green-500" />
                    Approved <Badge variant="secondary" className="ml-1 hidden sm:inline-flex">{counts.approved}</Badge>
                  </TabsTrigger>
                </TabsList>
                
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 sm:h-10"
                    onClick={() => setIsFiltersOpen(!isFiltersOpen)}
                  >
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {(boardFilter !== "all" || tileFilter !== "all" || teamFilter !== "all") && (
                      <Badge variant="secondary" className="ml-2 px-1 rounded-full h-5 min-w-5 flex items-center justify-center">!</Badge>
                    )}
                  </Button>
                </div>
              </div>
            </Tabs>
          </div>

          <Collapsible open={isFiltersOpen} onOpenChange={setIsFiltersOpen}>
            <CollapsibleContent className="mt-4 space-y-4">
              <div className="flex items-center justify-between border-t pt-4">
                <h3 className="text-sm font-medium text-foreground">Advanced Filters</h3>
                {(boardFilter !== "all" || tileFilter !== "all" || teamFilter !== "all") && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBoardFilter("all")
                      setTileFilter("all")
                      setTeamFilter("all")
                    }}
                    className="h-8 text-muted-foreground hover:text-foreground"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {isAdminView && (
                  <>
                    <div>
                      <Label
                        htmlFor="board-filter"
                        className="mb-2 block text-sm font-medium text-muted-foreground"
                      >
                        Board Filter
                      </Label>
                      <Select value={boardFilter} onValueChange={setBoardFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by board" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Boards</SelectItem>
                          {uniqueBoards.map((board: any) => (
                            <SelectItem key={board.id} value={board.id}>
                              {board.title}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label
                        htmlFor="tile-filter"
                        className="mb-2 block text-sm font-medium text-muted-foreground"
                      >
                        Tile Filter
                      </Label>
                      <Select value={tileFilter} onValueChange={setTileFilter}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Filter by tile" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Tiles</SelectItem>
                          {uniqueTiles
                            .filter(
                              (t: any) =>
                                boardFilter === "all" ||
                                t.bingo?.id === boardFilter ||
                                t.bingoId === boardFilter
                            )
                            .map((tile: any) => (
                              <SelectItem key={tile.id} value={tile.id}>
                                {tile.title}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                {hasSufficientRights && (
                  <div>
                    <Label
                      htmlFor="team-filter"
                      className="mb-2 block text-sm font-medium text-muted-foreground"
                    >
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
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Submissions Display */}
        <div className="space-y-6">
          {filteredFlatSubmissions.length > 0 ? (
            hasSufficientRights ? (
              /* --- SPLIT PANE TRIAGE INBOX (Power User View) --- */
              <div className="flex flex-col md:flex-row gap-6 h-[800px] max-h-[70vh]">
                
                {/* Left Pane: Queue List */}
                <div className="w-full md:w-1/3 lg:w-1/4 flex flex-col gap-2 overflow-y-auto pr-2 border-r border-border custom-scrollbar">
                  {filteredFlatSubmissions.map((submission: any) => {
                    const currentStatus = getSubmissionStatus(submission.id, submission.status || "pending")
                    const isSelected = selectedSubmissionId === submission.id
                    
                    return (
                      <div
                        key={submission.id}
                        onClick={() => setSelectedSubmissionId(submission.id)}
                        className={`p-3 rounded-lg border transition-colors cursor-pointer flex gap-3 ${isSelected ? 'bg-primary/5 border-primary shadow-xs' : 'bg-card border-border hover:bg-muted/50'}`}
                      >
                        <div className="relative w-16 h-12 rounded-md overflow-hidden shrink-0 border border-border/50">
                          <Image
                            src={getOptimizedImageUrl(submission.image.path)}
                            alt="thumb"
                            fill
                            className="object-cover"
                          />
                        </div>
                        <div className="flex flex-col min-w-0 overflow-hidden w-full">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-sm truncate text-foreground">{submission.team.name}</span>
                            <div className="scale-75 origin-right shrink-0">{getStatusBadge(currentStatus)}</div>
                          </div>
                          <span className="text-xs text-muted-foreground truncate">{submission.user.runescapeName || submission.user.name || "Unknown"}</span>
                          <span className="text-[10px] text-muted-foreground/70">{new Date(submission.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right Pane: Focus Area */}
                <div className="w-full md:w-2/3 lg:w-3/4 flex flex-col gap-4 overflow-y-auto pl-2 custom-scrollbar">
                  {filteredFlatSubmissions.filter((s: any) => s.id === selectedSubmissionId).map((submission: any) => {
                    const currentSubmissionStatus = getSubmissionStatus(submission.id, submission.status || "pending")
                    const currentTileStatus = getTileStatus(submission.teamTileSubmissionId, submission.parentStatus)
                    
                    return (
                      <div key={`focus-${submission.id}`} className="flex flex-col gap-6 animate-in fade-in duration-200">
                        {/* Header Context */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 bg-muted/20 p-4 rounded-lg border border-border">
                          <div>
                            <h2 className="text-xl font-bold flex items-center gap-2">
                              <div
                                className="h-4 w-4 rounded-full shadow-xs"
                                style={{ backgroundColor: `hsl(${(submission.team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)` }}
                              />
                              {submission.team.name}
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                              Submitted by {submission.user.runescapeName || submission.user.name || "Unknown"} at {new Date(submission.createdAt).toLocaleString()}
                            </p>
                            {isAdminView && submission.tile && (
                              <p className="text-sm font-medium mt-1">
                                {submission.tile.bingo?.title} &rarr; {submission.tile.title}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex flex-col items-end gap-2">
                             <div className="flex gap-2">
                               {getStatusBadge(currentSubmissionStatus)}
                               <Badge variant="outline" className="capitalize border-muted-foreground/30">{currentTileStatus.replace("_", " ")} Tile</Badge>
                             </div>
                             
                             {/* Tile Force Actions */}
                             <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm" className="h-8">
                                  Tile Actions
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  className="text-green-600 focus:bg-green-50 focus:text-green-700 cursor-pointer"
                                  onClick={() => handleTeamTileSubmissionStatusUpdate(submission.teamTileSubmissionId, "completed")}
                                  disabled={currentTileStatus === "completed"}
                                >
                                  <Check className="mr-2 h-4 w-4" /> Force Approve Tile
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-yellow-600 focus:bg-yellow-50 focus:text-yellow-700 cursor-pointer"
                                  onClick={() => handleTeamTileSubmissionStatusUpdate(submission.teamTileSubmissionId, "needs_attention")}
                                  disabled={currentTileStatus === "needs_attention"}
                                >
                                  <AlertTriangle className="mr-2 h-4 w-4" /> Flag Tile for Review
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        {/* High-Res Image Display */}
                        <div 
                           className="relative w-full rounded-xl overflow-hidden border border-border shadow-md bg-black/5 flex items-center justify-center cursor-pointer group"
                           style={{ minHeight: '400px', maxHeight: '600px' }}
                           onClick={() => onFullSizeImageView(getOptimizedImageUrl(submission.image.path), "Submission")}
                        >
                          <Image
                            src={getOptimizedImageUrl(submission.image.path)}
                            alt="Submission"
                            fill
                            className="object-contain transition-transform group-hover:scale-[1.02]"
                            priority
                          />
                        </div>
                        
                        {/* Auto-submission metadata */}
                        {submission.isAutoSubmission && (
                          <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30 grid grid-cols-2 gap-x-4">
                            <div className="col-span-2 flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
                              <Zap className="h-4 w-4" /> Auto-Submitted
                            </div>
                            {submission.sourceName && (
                              <div className="text-sm text-muted-foreground"><span className="font-medium">Source:</span> {submission.sourceName}</div>
                            )}
                            {submission.pluginAccountName && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground"><User className="h-4 w-4" /> {submission.pluginAccountName}</div>
                            )}
                          </div>
                        )}

                        {/* Action Zone */}
                        <div className="flex flex-col gap-4 p-5 rounded-lg border border-border bg-card shadow-xs">
                          <h3 className="font-semibold text-lg">Goal Assignment</h3>
                          
                          <InlineGoalAssignment
                            submissionId={submission.id}
                            currentGoalId={getSubmissionGoal(submission.id, submission.goalId)}
                            currentValue={getSubmissionValue(submission.id, submission.submissionValue)}
                            goals={submission.tile?.goals || selectedTile?.goals || []}
                            goalValues={goalValuesCache[submission.goalId || ""] || []}
                            onAssign={(goalId, value) => handleInlineGoalAssignment(submission.id, goalId, value)}
                            hasSufficientRights={hasSufficientRights}
                          />

                          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-border">
                            <Button
                              className={`flex-1 min-w-[140px] h-10 ${currentSubmissionStatus !== "approved" ? "bg-green-600 hover:bg-green-700 text-white" : ""}`}
                              variant={currentSubmissionStatus === "approved" ? "secondary" : "default"}
                              onClick={() => handleSubmissionStatusUpdate(submission.id, "approved")}
                              disabled={currentSubmissionStatus === "approved"}
                            >
                              <Check className="mr-2 h-4 w-4" />
                              Approve <span className="ml-1 opacity-50 text-[10px] hidden sm:inline">(⇧A)</span>
                            </Button>

                            <Button
                              className={`flex-1 min-w-[140px] h-10 ${currentSubmissionStatus !== "needs_review" ? "bg-yellow-500 hover:bg-yellow-600 text-white" : ""}`}
                              variant={currentSubmissionStatus === "needs_review" ? "secondary" : "default"}
                              onClick={() => handleNeedsReviewClick(submission.id)}
                              disabled={currentSubmissionStatus === "needs_review"}
                            >
                              <AlertTriangle className="mr-2 h-4 w-4" />
                              Request Changes <span className="ml-1 opacity-50 text-[10px] hidden sm:inline">(⇧R)</span>
                            </Button>

                            <AlertDialog open={submissionToDelete === submission.id} onOpenChange={(open) => !open && setSubmissionToDelete(null)}>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" className="h-10 text-destructive hover:bg-destructive/10 border-destructive/20">
                                  <X className="mr-2 h-4 w-4" /> Delete
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Submission</AlertDialogTitle>
                                  <AlertDialogDescription>Are you sure you want to delete this submission? This action cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => { onDeleteSubmission(submission.id); setSubmissionToDelete(null); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>

                        {/* Comments section */}
                        <div className="mt-2">
                           {showCommentForm === submission.id && (
                            <div className="mb-4">
                              <CommentForm
                                submissionId={submission.id}
                                onSubmit={(comment) => handleCommentSubmit(submission.id, comment)}
                                onCancel={handleCommentCancel}
                                isLoading={isSubmittingComment}
                              />
                            </div>
                          )}
                          <SubmissionCommentDisplay
                            comments={submissionComments[submission.id] || []}
                            submissionId={submission.id}
                            canViewComments={true}
                          />
                        </div>

                      </div>
                    )
                  })}
                  {(!selectedSubmissionId || !filteredFlatSubmissions.find((s: any) => s.id === selectedSubmissionId)) && (
                    <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground h-full min-h-[300px]">
                      <Check className="h-12 w-12 text-muted-foreground/30 mb-4" />
                      <p>Select a submission to review</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* --- STANDARD GRID (Normal User View) --- */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {filteredFlatSubmissions.map((submission: any) => {
                  const currentSubmissionStatus = getSubmissionStatus(submission.id, submission.status || "pending")
                  
                  return (
                    <div key={submission.id} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
                      <div className="relative aspect-video">
                        <Image
                          src={getOptimizedImageUrl(submission.image.path)}
                          alt="Submission"
                          fill
                          className="cursor-pointer object-cover transition-opacity hover:opacity-90"
                          onClick={() => onFullSizeImageView(getOptimizedImageUrl(submission.image.path), "Submission")}
                        />
                        <div className="absolute right-2 top-2">
                          {getStatusBadge(currentSubmissionStatus)}
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        <div>
                          <div className="font-semibold text-foreground truncate">{submission.team.name}</div>
                          <div className="text-sm text-muted-foreground">by {submission.user.runescapeName || submission.user.name || "Unknown"}</div>
                          <div className="text-xs text-muted-foreground mt-1">{new Date(submission.createdAt).toLocaleString()}</div>
                        </div>
                        
                        {/* Auto-submission info if applicable */}
                        {submission.isAutoSubmission && (
                          <div className="text-xs flex items-center gap-1 text-blue-600 dark:text-blue-400">
                             <Zap className="h-3 w-3" /> Auto-submitted
                          </div>
                        )}

                        <SubmissionCommentDisplay
                          comments={submissionComments[submission.id] || []}
                          submissionId={submission.id}
                          canViewComments={true}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/20 py-16 text-center flex flex-col items-center justify-center h-full">
              <Check className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-lg font-medium text-foreground mb-1">All caught up!</p>
              <p className="text-muted-foreground text-sm">
                {statusFilter === "pending"
                  ? "No pending submissions require your attention."
                  : "No submissions match the current filters."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
