/* eslint-disable */
"use client";

import type React from "react";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Check,
  AlertTriangle,
  X,
  Upload,
  Clock,
  CheckCircle2,
  Link,
  Users,
  Hash,
  Search,
  Star,
  ChevronsUpDown,
  Loader2,
  Zap,
  User,
} from "lucide-react";
import type { Tile, Team, SubmissionComment } from "@/app/actions/events";
import type { SelectableUser } from "@/app/actions/bingo";
import { CommentForm } from "@/components/comment-form";
import { SubmissionCommentDisplay } from "@/components/submission-comment";
import { SubmissionUploadForm } from "@/components/submission-upload-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
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
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InlineGoalAssignment } from "@/components/inline-goal-assignment";
import { getGoalValues } from "@/app/actions/goals";
import { toast } from "@/hooks/use-toast";

interface SubmissionsTabProps {
  selectedTile: Tile | null;
  currentTeamId: string | undefined;
  teams: Team[];
  hasSufficientRights: boolean;
  selectedImage: File | null;
  pastedImage: File | null;
  isSubmissionsLocked: boolean;
  isUploadingImage: boolean;
  onImageChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onImageSubmit: (onBehalfOfUserId?: string) => void;
  onFullSizeImageView: (src: string, alt: string) => void;
  onTeamTileSubmissionStatusUpdate: (
    teamTileSubmissionId: string | undefined,
    newStatus: "approved" | "needs_review",
  ) => void;
  onSubmissionStatusUpdate: (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null,
  ) => void;
  onDeleteSubmission: (submissionId: string) => void;
  // New props for submitting on behalf of another user
  selectableUsers?: SelectableUser[];
  selectedUserId?: string;
  onUserSelect?: (userId: string) => void;
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
}: SubmissionsTabProps) {
  const [expandedGoalForms, setExpandedGoalForms] = useState<Set<string>>(
    new Set(),
  );
  const [goalValuesCache, setGoalValuesCache] = useState<Record<string, any[]>>(
    {},
  );

  // Filter out unassigned users before passing to child components
  const assignedUsers =
    selectableUsers?.filter(
      (user) => user.teamName !== undefined && user.teamName !== null,
    ) ?? [];
  const [submissionToDelete, setSubmissionToDelete] = useState<string | null>(
    null,
  );
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [teamFilter, setTeamFilter] = useState<string>("all");

  // Local state to track real-time status changes
  const [localTileStatuses, setLocalTileStatuses] = useState<
    Record<string, "approved" | "needs_review" | "pending">
  >({});
  const [localSubmissionStatuses, setLocalSubmissionStatuses] = useState<
    Record<string, "approved" | "needs_review" | "pending">
  >({});

  // Comment-related state
  const [submissionComments, setSubmissionComments] = useState<
    Record<string, SubmissionComment[]>
  >({});
  const [showCommentForm, setShowCommentForm] = useState<string | null>(null);
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);

  // Toggle expanded state for inline goal assignment
  const toggleGoalForm = (submissionId: string) => {
    setExpandedGoalForms((prev) => {
      const next = new Set(prev);
      if (next.has(submissionId)) {
        next.delete(submissionId);
      } else {
        next.add(submissionId);
      }
      return next;
    });
  };

  // Handle inline goal assignment
  const handleInlineGoalAssignment = (
    submissionId: string,
    goalId: string | null,
    value: number | null,
  ) => {
    onSubmissionStatusUpdate(submissionId, "pending", goalId, value);

    // Close the expanded form
    setExpandedGoalForms((prev) => {
      const next = new Set(prev);
      next.delete(submissionId);
      return next;
    });
  };

  const currentTeam = teams.find((team) => team.id === currentTeamId);
  const currentTeamSubmission = selectedTile?.teamTileSubmissions?.find(
    (sub) => sub.teamId === currentTeamId,
  );

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
    );
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return (
          <Badge className="border-green-200 bg-green-100 px-3 py-1 text-green-800">
            <Check className="mr-1 h-3 w-3" />
            Approved
          </Badge>
        );
      case "needs_review":
        return (
          <Badge className="border-yellow-200 bg-yellow-100 px-3 py-1 text-yellow-800">
            <AlertTriangle className="mr-1 h-3 w-3" />
            Needs Review
          </Badge>
        );
      default:
        return (
          <Badge className="border-blue-200 bg-blue-100 px-3 py-1 text-blue-800">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  // Enhanced handlers with real-time updates
  const handleTeamTileSubmissionStatusUpdate = async (
    teamTileSubmissionId: string | undefined,
    newStatus: "approved" | "needs_review",
  ) => {
    if (!teamTileSubmissionId) return;

    // Optimistically update local state
    setLocalTileStatuses((prev) => ({
      ...prev,
      [teamTileSubmissionId]: newStatus,
    }));

    // If approving the tile, also update all submissions in that tile
    if (newStatus === "approved") {
      const teamSubmission = selectedTile?.teamTileSubmissions?.find(
        (ts) => ts.id === teamTileSubmissionId,
      );
      if (teamSubmission) {
        const updatedSubmissionStatuses: Record<string, "approved"> = {};
        teamSubmission.submissions.forEach((sub) => {
          updatedSubmissionStatuses[sub.id] = "approved";
        });
        setLocalSubmissionStatuses((prev) => ({
          ...prev,
          ...updatedSubmissionStatuses,
        }));
      }
    }

    // Call the original handler
    onTeamTileSubmissionStatusUpdate(teamTileSubmissionId, newStatus);
  };

  const handleSubmissionStatusUpdate = async (
    submissionId: string,
    newStatus: "pending" | "approved" | "needs_review",
    goalId?: string | null,
    submissionValue?: number | null,
  ) => {
    // Optimistically update local state
    setLocalSubmissionStatuses((prev) => ({
      ...prev,
      [submissionId]: newStatus,
    }));

    // If marking submission as needs_review, also update the parent tile
    if (newStatus === "needs_review") {
      // Find the parent tile submission
      selectedTile?.teamTileSubmissions?.forEach((teamSub) => {
        teamSub.submissions.forEach((sub) => {
          if (sub.id === submissionId) {
            setLocalTileStatuses((prev) => ({
              ...prev,
              [teamSub.id]: "needs_review",
            }));
          }
        });
      });
    }

    // Call the original handler
    onSubmissionStatusUpdate(submissionId, newStatus, goalId, submissionValue);
  };

  // Helper function to get the current status (local override or original)
  const getTileStatus = (
    teamTileSubmissionId: string,
    originalStatus: string,
  ) => {
    return localTileStatuses[teamTileSubmissionId] || originalStatus;
  };

  const getSubmissionStatus = (
    submissionId: string,
    originalStatus: string,
  ) => {
    return localSubmissionStatuses[submissionId] || originalStatus;
  };

  // Comment-related functions
  const loadSubmissionComments = async (submissionId: string) => {
    try {
      const response = await fetch(`/api/submissions/${submissionId}/comments`);
      if (response.ok) {
        const comments = await response.json();
        setSubmissionComments((prev) => ({
          ...prev,
          [submissionId]: comments,
        }));
      }
    } catch (error) {
      console.error("Failed to load comments:", error);
    }
  };

  const handleNeedsReviewClick = (submissionId: string) => {
    // Only allow reviewers (those with sufficient rights) to add comments
    if (!hasSufficientRights) return;

    const currentStatus = getSubmissionStatus(
      submissionId,
      selectedTile?.teamTileSubmissions
        ?.find((teamSub) =>
          teamSub.submissions.some((sub) => sub.id === submissionId),
        )
        ?.submissions.find((sub) => sub.id === submissionId)?.status ||
        "pending",
    );

    if (currentStatus === "needs_review") return;

    // Load existing comments if not already loaded
    if (!submissionComments[submissionId]) {
      loadSubmissionComments(submissionId);
    }

    setShowCommentForm(submissionId);
  };

  const handleCommentSubmit = async (submissionId: string, comment: string) => {
    setIsSubmittingComment(true);
    try {
      // Update status with comment
      await handleSubmissionStatusUpdate(submissionId, "needs_review");

      // Add comment via API
      const response = await fetch(
        `/api/submissions/${submissionId}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ comment }),
        },
      );

      if (response.ok) {
        const newComment = await response.json();
        setSubmissionComments((prev) => ({
          ...prev,
          [submissionId]: [newComment, ...(prev[submissionId] || [])],
        }));

        toast({
          title: "Review comment added",
          description: "Submission marked as needs review with comment.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error("Failed to submit comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsSubmittingComment(false);
      setShowCommentForm(null);
    }
  };

  const handleCommentCancel = () => {
    setShowCommentForm(null);
  };

  // Load comments for submissions that have "needs_review" status
  useEffect(() => {
    if (selectedTile?.teamTileSubmissions) {
      selectedTile.teamTileSubmissions.forEach((teamSub) => {
        teamSub.submissions.forEach((submission) => {
          if (
            submission.status === "needs_review" &&
            !submissionComments[submission.id]
          ) {
            loadSubmissionComments(submission.id);
          }
        });
      });
    }
  }, [selectedTile?.id, submissionComments]);

  // Filter submissions based on user role and selected filters
  const getFilteredSubmissions = () => {
    if (!selectedTile?.teamTileSubmissions) return [];

    let submissions = selectedTile.teamTileSubmissions;

    // If user is a normal participant, only show their team's submissions
    if (!hasSufficientRights && currentTeamId) {
      submissions = submissions.filter(
        (teamSub) => teamSub.teamId === currentTeamId,
      );
    }

    // Apply team filter (for admin/management users)
    if (hasSufficientRights && teamFilter !== "all") {
      submissions = submissions.filter(
        (teamSub) => teamSub.teamId === teamFilter,
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      submissions = submissions.filter((teamSub) => {
        // Check team submission status (with local override)
        const currentTileStatus = getTileStatus(teamSub.id, teamSub.status);
        if (currentTileStatus === statusFilter) return true;

        // Also check individual submission statuses (with local override)
        return teamSub.submissions.some((sub) => {
          const currentSubmissionStatus = getSubmissionStatus(
            sub.id,
            sub.status || "pending",
          );
          return currentSubmissionStatus === statusFilter;
        });
      });
    }

    return submissions;
  };

  const filteredSubmissions = getFilteredSubmissions();

  return (
    <div className="max-h-[60vh] space-y-6 overflow-y-auto bg-background pr-4 text-foreground">
      <div className="space-y-6 p-4">
        {/* Current team submission form */}
        {currentTeamId && !isSubmissionsLocked && (
          <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
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
        <div className="space-y-4 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-foreground">Filters</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <Label
                htmlFor="status-filter"
                className="mb-2 block text-sm font-medium text-muted-foreground"
              >
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
        </div>

        {/* Team submissions */}
        <div className="space-y-6">
          {filteredSubmissions.length > 0 ? (
            filteredSubmissions.map((teamSubmission) => {
              const currentTileStatus = getTileStatus(
                teamSubmission.id,
                teamSubmission.status,
              );

              return (
                <div
                  key={teamSubmission.id}
                  className="overflow-hidden rounded-lg border border-border bg-card shadow-sm"
                >
                  <div className="border-b border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-4 w-4 rounded-full shadow-sm"
                          style={{
                            backgroundColor: `hsl(${(teamSubmission.team.name.charCodeAt(0) * 10) % 360}, 70%, 50%)`,
                          }}
                        />
                        <h3 className="font-semibold text-foreground">
                          {teamSubmission.team.name}
                        </h3>
                        {getStatusBadge(currentTileStatus)}
                      </div>
                      {hasSufficientRights && (
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700"
                            onClick={() =>
                              handleTeamTileSubmissionStatusUpdate(
                                teamSubmission.id,
                                "approved",
                              )
                            }
                            disabled={currentTileStatus === "approved"}
                          >
                            <Check className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 border-yellow-200 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
                            onClick={() =>
                              handleTeamTileSubmissionStatusUpdate(
                                teamSubmission.id,
                                "needs_review",
                              )
                            }
                            disabled={currentTileStatus === "needs_review"}
                          >
                            <AlertTriangle className="mr-1 h-4 w-4" />
                            Needs Review
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {teamSubmission.submissions.length > 0 ? (
                    <div className="submission-grid grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 md:grid-cols-3">
                      {teamSubmission.submissions
                        .filter((submission) => {
                          // Apply status filter to individual submissions (with local override)
                          if (statusFilter === "all") return true;
                          const currentSubmissionStatus = getSubmissionStatus(
                            submission.id,
                            submission.status || "pending",
                          );
                          return currentSubmissionStatus === statusFilter;
                        })
                        .map((submission) => {
                          const currentSubmissionStatus = getSubmissionStatus(
                            submission.id,
                            submission.status || "pending",
                          );

                          return (
                            <div
                              key={submission.id}
                              className="overflow-hidden rounded-md border border-border bg-card shadow-sm transition-shadow hover:shadow-md"
                            >
                              <div className="relative aspect-video">
                                <Image
                                  src={
                                    submission.image.path || "/placeholder.svg"
                                  }
                                  alt={`Submission by ${submission.user.runescapeName || "Unknown"}`}
                                  fill
                                  className="cursor-pointer object-cover transition-opacity hover:opacity-90"
                                  onClick={() =>
                                    onFullSizeImageView(
                                      submission.image.path,
                                      `Submission by ${submission.user.runescapeName || "Unknown"}`,
                                    )
                                  }
                                />
                                {/* Status overlay */}
                                <div className="absolute right-2 top-2">
                                  {getStatusBadge(currentSubmissionStatus)}
                                </div>
                              </div>
                              <div className="space-y-3 p-3">
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="truncate text-sm font-medium text-foreground">
                                      {submission.user.runescapeName ||
                                        submission.user.name ||
                                        "Unknown"}
                                    </div>
                                    <div className="mt-1 text-xs text-muted-foreground">
                                      {new Date(
                                        submission.createdAt,
                                      ).toLocaleString()}
                                    </div>
                                  </div>
                                </div>

                                {/* Auto-submission metadata */}
                                {submission.isAutoSubmission && (
                                  <div className="space-y-1 rounded-md border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-950/30">
                                    <div className="flex items-center gap-1 text-xs font-medium text-blue-700 dark:text-blue-300">
                                      <Zap className="h-3 w-3" />
                                      Auto-Submitted
                                    </div>
                                    {submission.sourceName && (
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium">
                                          Source:
                                        </span>{" "}
                                        {submission.sourceName}
                                        {submission.sourceNpcId &&
                                          ` (NPC #${submission.sourceNpcId})`}
                                      </div>
                                    )}
                                    {submission.sourceItemId && (
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium">
                                          Item:
                                        </span>{" "}
                                        #{submission.sourceItemId}
                                      </div>
                                    )}
                                    {submission.pluginAccountName && (
                                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <User className="h-3 w-3" />
                                        {submission.pluginAccountName}
                                      </div>
                                    )}
                                    {submission.sourceType && (
                                      <div className="text-xs text-muted-foreground">
                                        <span className="font-medium">
                                          Type:
                                        </span>{" "}
                                        {submission.sourceType}
                                      </div>
                                    )}
                                    {/* Location information */}
                                    {(submission.locationWorldX !== null ||
                                      submission.locationWorldY !== null ||
                                      submission.locationWorldNumber !==
                                        null) && (
                                      <div className="mt-1 border-t border-blue-200 pt-1 text-xs text-muted-foreground dark:border-blue-800">
                                        <div className="mb-0.5 font-medium">
                                          Location:
                                        </div>
                                        {submission.locationWorldNumber && (
                                          <div>
                                            World{" "}
                                            {submission.locationWorldNumber}
                                          </div>
                                        )}
                                        {submission.locationWorldX !== null &&
                                          submission.locationWorldY !==
                                            null && (
                                            <div>
                                              Coords: (
                                              {submission.locationWorldX},{" "}
                                              {submission.locationWorldY}
                                              {submission.locationPlane !=
                                                null &&
                                              submission.locationPlane > 0
                                                ? `, Plane ${submission.locationPlane}`
                                                : ""}
                                              )
                                            </div>
                                          )}
                                        {submission.locationRegionId && (
                                          <div className="text-xs opacity-75">
                                            Region ID:{" "}
                                            {submission.locationRegionId}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* Inline Goal Assignment */}
                                <InlineGoalAssignment
                                  submissionId={submission.id}
                                  currentGoalId={submission.goalId}
                                  currentValue={submission.submissionValue}
                                  goals={selectedTile?.goals || []}
                                  goalValues={
                                    goalValuesCache[submission.goalId || ""] ||
                                    []
                                  }
                                  onAssign={(goalId, value) =>
                                    handleInlineGoalAssignment(
                                      submission.id,
                                      goalId,
                                      value,
                                    )
                                  }
                                  hasSufficientRights={hasSufficientRights}
                                  isExpanded={expandedGoalForms.has(
                                    submission.id,
                                  )}
                                  onToggle={() => toggleGoalForm(submission.id)}
                                />

                                {hasSufficientRights && (
                                  <div className="mt-2 flex justify-end gap-1 border-t border-border pt-2">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-green-600 hover:bg-green-50 hover:text-green-700"
                                            onClick={() =>
                                              handleSubmissionStatusUpdate(
                                                submission.id,
                                                "approved",
                                              )
                                            }
                                            disabled={
                                              currentSubmissionStatus ===
                                              "approved"
                                            }
                                          >
                                            <Check className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Approve Submission
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-8 w-8 p-0 text-yellow-600 hover:bg-yellow-50 hover:text-yellow-700"
                                            onClick={() =>
                                              handleNeedsReviewClick(
                                                submission.id,
                                              )
                                            }
                                            disabled={
                                              currentSubmissionStatus ===
                                              "needs_review"
                                            }
                                          >
                                            <AlertTriangle className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          Mark as Needs Review
                                        </TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>

                                    <AlertDialog
                                      open={
                                        submissionToDelete === submission.id
                                      }
                                      onOpenChange={(open) =>
                                        !open && setSubmissionToDelete(null)
                                      }
                                    >
                                      <TooltipProvider>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <AlertDialogTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                onClick={() =>
                                                  setSubmissionToDelete(
                                                    submission.id,
                                                  )
                                                }
                                              >
                                                <X className="h-4 w-4" />
                                              </Button>
                                            </AlertDialogTrigger>
                                          </TooltipTrigger>
                                          <TooltipContent>
                                            Delete Submission
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>
                                            Delete Submission
                                          </AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete this
                                            submission? This action cannot be
                                            undone.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>
                                            Cancel
                                          </AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => {
                                              onDeleteSubmission(submission.id);
                                              setSubmissionToDelete(null);
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

                                {/* Comment section - only show if user has sufficient rights to add comments */}
                                {hasSufficientRights &&
                                  showCommentForm === submission.id && (
                                    <CommentForm
                                      submissionId={submission.id}
                                      onSubmit={(comment) =>
                                        handleCommentSubmit(
                                          submission.id,
                                          comment,
                                        )
                                      }
                                      onCancel={handleCommentCancel}
                                      isLoading={isSubmittingComment}
                                    />
                                  )}

                                {/* Display existing comments - everyone can view */}
                                <SubmissionCommentDisplay
                                  comments={
                                    submissionComments[submission.id] || []
                                  }
                                  submissionId={submission.id}
                                  canViewComments={true}
                                />
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-muted-foreground">
                      No submissions yet
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-lg bg-muted/30 py-8 text-center">
              <p className="text-muted-foreground">
                {statusFilter === "pending"
                  ? "No pending submissions for this tile yet."
                  : "No submissions match the current filters."}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
