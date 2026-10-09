"use client"

import React from "react"
import Image from "next/image"
import { Zap, EyeOff, CheckCircle2, AlertCircle, Clock } from "lucide-react"
import type { Tile } from "@/types/model"
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import getRandomFrog from "@/lib/getRandomFrog"
import Markdown from "react-markdown"
import { CompactGoalTree } from "./compact-goal-tree"
import {
  getGoalTreeWithProgress,
  type GoalTreeNode,
} from "@/app/actions/goal-groups"

interface TeamProgress {
  goalId: string
  currentValue: number
  isComplete: boolean
}

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  userRole: "participant" | "management" | "admin"
  currentTeamId?: string
  isLocked: boolean
  isLoading?: boolean
}

export const BingoTile = React.memo(function BingoTile({
  tile,
  onClick,
  onTogglePlaceholder,
  userRole,
  currentTeamId,
  isLocked,
  isLoading = false,
}: BingoTileProps) {
  const isManagement = userRole === "management" || userRole === "admin"

  // Goal tree data state for hovercard
  const [goalTreeData, setGoalTreeData] = React.useState<{
    tree: GoalTreeNode[]
    teamProgress: TeamProgress[]
  } | null>(null)
  const [isLoadingTree, setIsLoadingTree] = React.useState(false)
  const [isHoverCardOpen, setIsHoverCardOpen] = React.useState(false)

  // Load goal tree when hovercard opens
  React.useEffect(() => {
    if (
      isHoverCardOpen &&
      tile.goals &&
      tile.goals.length > 0 &&
      !goalTreeData &&
      currentTeamId
    ) {
      const loadTreeData = async () => {
        setIsLoadingTree(true)
        try {
          const data = await getGoalTreeWithProgress(tile.id, currentTeamId)
          setGoalTreeData(data)
        } catch (error) {
          console.error("Failed to load goal tree:", error)
        } finally {
          setIsLoadingTree(false)
        }
      }
      void loadTreeData()
    }
  }, [isHoverCardOpen, tile.id, tile.goals, currentTeamId, goalTreeData])

  const currentTeamSubmission = React.useMemo(() => {
    if (!currentTeamId || !tile.teamTileSubmissions) return null
    return tile.teamTileSubmissions.find((tts) => tts.teamId === currentTeamId)
  }, [currentTeamId, tile.teamTileSubmissions])

  const renderStatusBadge = (status: string, label?: string) => {
    let normalizedStatus = status;
    if (status === "completed") normalizedStatus = "approved";
    if (status === "needs_attention") normalizedStatus = "needs_review";

    const badgeConfig: Record<string, { icon: React.ReactNode, classes: string, text: string }> = {
      approved: {
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
        classes: "bg-success text-success-foreground",
        text: label || "Completed"
      },
      needs_review: {
        icon: <AlertCircle className="h-3.5 w-3.5" />,
        classes: "bg-warning text-warning-foreground",
        text: label || "Changes requested"
      },
      pending: {
        icon: <Clock className="h-3.5 w-3.5" />,
        classes: "bg-pending text-pending-foreground",
        text: label || "Pending review"
      }
    };

    const config = badgeConfig[normalizedStatus];
    if (!config) return null;

    return (
      <div className={`flex items-center gap-1.5 border border-solid border-black px-2 py-0.5 text-xs font-medium rounded-sm ${config.classes}`}>
        {config.icon}
        <span>{config.text}</span>
      </div>
    );
  }

  const getCompletionStatus = () => {
    if (!currentTeamSubmission) return "incomplete"
    if (currentTeamSubmission.status === "completed") return "completed"
    return "incomplete"
  }

  const getSubmissionState = () => {
    if (!currentTeamSubmission) return null
    if (currentTeamSubmission.status === "needs_attention") return "needs_review"
    const submissions = currentTeamSubmission.submissions || []
    if (submissions.some(s => s.status === "needs_review")) return "needs_review"
    if (submissions.some(s => s.status === "pending")) return "pending"
    if (submissions.length > 0) return "approved"
    return null
  }

  const completionStatus = getCompletionStatus()
  const submissionState = getSubmissionState()

  const tileClasses = `
    relative rounded-sm overflow-hidden aspect-square group
    transition-all duration-150 ease-in-out
    min-h-[60px] sm:min-h-[80px] md:min-h-[100px] lg:min-h-[120px]
    touch-manipulation
    ${tile.isHidden && isLocked ? "bg-transparent" : ""}
    ${tile.isHidden && !isLocked ? "osrs-slot border-2 border-dashed border-muted-foreground/50 cursor-pointer hover:border-primary" : ""}
    ${
      !tile.isHidden
        ? `
      osrs-slot border-[3px] cursor-pointer hover:z-10 hover:brightness-110
      active:brightness-95 active:transition-none
      ${
        completionStatus === "completed"
          ? "border-success"
          : submissionState === "needs_review"
            ? "border-warning"
            : submissionState
              ? "border-pending"
              : ""
      }
    `
        : ""
    }
  `

  const handleClick = () => {
    if (tile.isHidden && !isLocked && isManagement) {
      onTogglePlaceholder(tile)
    } else if (!tile.isHidden || !isLocked) {
      onClick(tile)
    }
  }

  // Only show hover card if tile is not hidden or if user has management rights
  const shouldShowHoverCard =
    !tile.isHidden || (tile.isHidden && isManagement && !isLocked)

  return (
    <HoverCard
      openDelay={200}
      closeDelay={100}
      onOpenChange={setIsHoverCardOpen}
    >
      <HoverCardTrigger asChild>
        <div
          className={`${tileClasses} focus:scale-[1.01] focus:outline-hidden focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 focus:ring-offset-background sm:focus:scale-[1.02] sm:focus:ring-4 sm:focus:ring-offset-2 lg:focus:scale-105`}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleClick()
            }
          }}
          aria-label={`Bingo tile: ${tile.title}. Worth ${tile.weight} points. Current status: ${completionStatus === "completed" ? "Completed" : "Incomplete"}. ${submissionState === "pending" ? "Has pending submissions. " : ""}${submissionState === "needs_review" ? "Changes requested on submissions. " : ""}${tile.description ? `Description: ${tile.description.substring(0, 100)}...` : ""}`}
          aria-describedby={
            tile.description ? `tile-desc-${tile.id}` : undefined
          }
        >
          {!tile.isHidden && (
            <>
              {tile.headerImage ? (
                <Image
                  unoptimized
                  src={tile.headerImage || getRandomFrog()}
                  alt={tile.title}
                  fill
                  className={`object-contain ${
                    completionStatus === "completed"
                      ? "brightness-110"
                      : submissionState
                        ? ""
                        : "opacity-80 grayscale group-hover:opacity-100 group-hover:grayscale-0"
                  }`}
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center ${
                    completionStatus === "completed"
                      ? "bg-success/30"
                      : submissionState === "needs_review"
                        ? "bg-warning/25"
                        : submissionState
                          ? "bg-pending/25"
                          : "bg-secondary"
                  }`}
                >
                  <span className="osrs-text-shadow px-2 text-center font-display text-lg font-semibold text-osrs-gold">
                    {tile.title}
                  </span>
                </div>
              )}
              {/* Completed check overlay badge (bottom-right, inventory style) */}
              {completionStatus === "completed" && (
                <div
                  className="absolute right-1 bottom-1 z-10 flex h-6 w-6 items-center justify-center rounded-sm border border-black bg-success text-success-foreground shadow-sm"
                  title="Completed"
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                </div>
              )}
              {/* Submission Status Badges */}
              {submissionState === "needs_review" && (
                <div className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-sm border border-black bg-warning text-warning-foreground shadow-sm" title="Changes Requested">
                  <span className="text-xs font-bold">!</span>
                </div>
              )}
              {submissionState === "pending" && (
                <div className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-sm border border-black bg-pending text-pending-foreground shadow-sm" title="Pending Review">
                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                </div>
              )}

              {/* Tile weight shown like an item quantity */}
              <span className="osrs-qty absolute left-1 top-1 z-10 text-sm">
                {tile.weight}
              </span>

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              )}
            </>
          )}
          {tile.isHidden && !isLocked && isManagement && (
            <div className="absolute inset-0 flex items-center justify-center text-center text-sm text-muted-foreground">
              Click to reveal
            </div>
          )}
        </div>
      </HoverCardTrigger>
      {shouldShowHoverCard && (
        <HoverCardContent
          side="right"
          align="start"
          className="w-80 max-w-[90vw] p-4"
        >
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="flex-1 wrap-break-word text-base font-semibold leading-tight">
                {tile.title}
              </h4>
              <div className="flex shrink-0 items-center gap-1 rounded-sm border border-black bg-secondary px-2 py-0.5">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium">{tile.weight} XP</span>
              </div>
            </div>

            {(completionStatus !== "incomplete" || submissionState) && (
              <div className="flex flex-wrap gap-2 pt-1 pb-2">
                {completionStatus !== "incomplete" ? (
                  renderStatusBadge(completionStatus)
                ) : (
                  submissionState && renderStatusBadge(
                    submissionState, 
                    submissionState === "needs_review" 
                      ? "Changes requested" 
                      : submissionState === "pending"
                        ? "Pending review"
                        : "Approved"
                  )
                )}
              </div>
            )}

            {tile.description && (
              <div className="prose prose-sm max-w-none text-sm text-muted-foreground">
                <Markdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 wrap-break-word leading-relaxed last:mb-0">
                        {children}
                      </p>
                    ),
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">
                        {children}
                      </strong>
                    ),
                    em: ({ children }) => (
                      <em className="italic">{children}</em>
                    ),
                    ul: ({ children }) => (
                      <ul className="my-2 list-inside list-disc space-y-1">
                        {children}
                      </ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="my-2 list-inside list-decimal space-y-1">
                        {children}
                      </ol>
                    ),
                    li: ({ children }) => (
                      <li className="wrap-break-word text-sm">{children}</li>
                    ),
                    h1: ({ children }) => (
                      <h1 className="mb-1 text-base font-semibold text-foreground">
                        {children}
                      </h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-1 text-sm font-semibold text-foreground">
                        {children}
                      </h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1 text-sm font-medium text-foreground">
                        {children}
                      </h3>
                    ),
                    a: ({ children, href }) => (
                      <a
                        href={href}
                        className="break-all text-primary underline hover:text-primary/80"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {tile.description.length > 200
                    ? `${tile.description.substring(0, 200)}...`
                    : tile.description}
                </Markdown>
              </div>
            )}

            {tile.goals && tile.goals.length > 0 && currentTeamId && (
              <div className="pt-1">
                <h5 className="mb-2 text-xs font-semibold">Goals:</h5>
                {isLoadingTree ? (
                  <div className="py-2 text-xs text-muted-foreground">
                    Loading goal tree...
                  </div>
                ) : goalTreeData ? (
                  <CompactGoalTree
                    tree={goalTreeData.tree}
                    teamProgress={goalTreeData.teamProgress}
                    showProgress={true}
                  />
                ) : (
                  <div className="text-xs text-muted-foreground">
                    Hover to load goals
                  </div>
                )}
              </div>
            )}

            {tile.goals && tile.goals.length > 0 && !currentTeamId && (
              <div className="pt-1">
                <h5 className="mb-2 text-xs font-semibold">Goals:</h5>
                <div className="text-xs text-muted-foreground">
                  {tile.goals.length} goal{tile.goals.length !== 1 ? "s" : ""}{" "}
                  defined
                </div>
              </div>
            )}

            {tile.isHidden && (
              <div className="mt-2 flex items-center gap-1.5 rounded-sm bg-secondary p-1.5 text-xs">
                <EyeOff className="h-3.5 w-3.5" />
                <span className="font-medium">Hidden tile</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  )
})
