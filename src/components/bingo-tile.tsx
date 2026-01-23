"use client"

import React from "react"
import Image from "next/image"
import { Zap, EyeOff } from "lucide-react"
import type { Tile } from "@/app/actions/events"
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

export function BingoTile({
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

  const renderStatusIcon = (
    status: "approved" | "needs_review" | "pending" | undefined
  ) => {
    const iconMap = {
      approved: (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white shadow-lg ring-2 ring-green-200 transition-all duration-300 dark:ring-green-800">
          <span className="text-sm font-bold">✓</span>
        </div>
      ),
      needs_review: (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-yellow-500 text-white shadow-lg ring-2 ring-yellow-200 transition-all duration-300 dark:ring-yellow-800">
          <span className="text-sm font-bold">!</span>
        </div>
      ),
      pending: (
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500 text-white shadow-lg ring-2 ring-blue-200 transition-all duration-300 dark:ring-blue-800">
          <span className="text-sm font-bold">⏳</span>
        </div>
      ),
    }
    return status ? iconMap[status] : null
  }

  const getCompletionStatus = () => {
    if (!currentTeamSubmission) return "incomplete"
    if (currentTeamSubmission.status === "approved") return "completed"
    if (currentTeamSubmission.status === "needs_review") return "needs_review"
    return "pending"
  }

  const completionStatus = getCompletionStatus()

  const tileClasses = `
    relative rounded-lg overflow-hidden aspect-square group
    transition-all duration-300 ease-in-out
    min-h-[60px] sm:min-h-[80px] md:min-h-[100px] lg:min-h-[120px]
    touch-manipulation
    ${tile.isHidden && isLocked ? "bg-transparent" : ""}
    ${tile.isHidden && !isLocked ? "border-2 border-dashed border-muted-foreground/40 bg-muted/20 cursor-pointer hover:bg-muted/40 hover:border-muted-foreground/60" : ""}
    ${
      !tile.isHidden
        ? `
      border-2 cursor-pointer transform hover:scale-[1.01] sm:hover:scale-[1.02] lg:hover:scale-[1.05] hover:z-10 hover:shadow-2xl
      active:scale-[0.98] active:transition-transform active:duration-100
      ${completionStatus === "completed" ? "border-green-500 bg-green-50 dark:bg-green-900/20 shadow-green-200/50 hover:shadow-green-300/60" : ""}
      ${completionStatus === "needs_review" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-yellow-200/50 hover:shadow-yellow-300/60" : ""}
      ${completionStatus === "pending" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-blue-200/50 hover:shadow-blue-300/60" : ""}
      ${completionStatus === "incomplete" ? "border-muted-foreground/40 hover:border-primary shadow-md hover:shadow-xl" : ""}
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
          className={`${tileClasses} focus:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-1 focus:ring-offset-background sm:focus:scale-[1.02] sm:focus:ring-4 sm:focus:ring-offset-2 lg:focus:scale-105`}
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              handleClick()
            }
          }}
          aria-label={`Bingo tile: ${tile.title}. Worth ${tile.weight} points. Current status: ${completionStatus === "completed" ? "Completed" : completionStatus === "pending" ? "Pending review" : completionStatus === "needs_review" ? "Needs review" : "Not started"}. ${tile.description ? `Description: ${tile.description.substring(0, 100)}...` : ""}`}
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
                  className={`object-contain transition-all duration-500 ease-in-out group-hover:scale-110 ${
                    completionStatus === "completed"
                      ? "saturate-110 brightness-110"
                      : completionStatus === "needs_review"
                        ? "saturate-95 brightness-95"
                        : completionStatus === "pending"
                          ? "brightness-100 saturate-100"
                          : "brightness-100 saturate-100 group-hover:brightness-110"
                  }`}
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center transition-all duration-300 ${
                    completionStatus === "completed"
                      ? "bg-green-500"
                      : completionStatus === "needs_review"
                        ? "bg-yellow-500"
                        : completionStatus === "pending"
                          ? "bg-blue-500"
                          : "bg-primary group-hover:bg-primary/90"
                  }`}
                >
                  <span className="px-2 text-center text-lg font-semibold text-primary-foreground">
                    {tile.title}
                  </span>
                </div>
              )}
              {/* Progress indicator overlay - only show on hover with enhanced animations */}
              {completionStatus === "completed" && (
                <div className="absolute inset-0 flex items-center justify-center bg-green-500/15 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100">
                  <div className="scale-90 transform rounded-full bg-green-500 p-3 text-white shadow-2xl ring-4 ring-green-200 transition-transform duration-300 group-hover:scale-100 dark:ring-green-800">
                    <span className="border-0 bg-green-500 text-sm font-semibold text-white">
                      ✓ Complete
                    </span>
                  </div>
                </div>
              )}
              {completionStatus === "needs_review" && (
                <div className="absolute inset-0 flex items-center justify-center bg-yellow-500/15 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100">
                  <div className="scale-90 transform rounded-full bg-yellow-500 p-3 text-white shadow-2xl ring-4 ring-yellow-200 transition-transform duration-300 group-hover:scale-100 dark:ring-yellow-800">
                    <span className="border-0 bg-yellow-500 text-sm font-semibold text-white">
                      ⚠ Review
                    </span>
                  </div>
                </div>
              )}
              {completionStatus === "pending" && (
                <div className="absolute inset-0 flex items-center justify-center bg-blue-500/15 opacity-0 backdrop-blur-sm transition-all duration-500 group-hover:opacity-100">
                  <div className="scale-90 transform rounded-full bg-blue-500 p-3 text-white shadow-2xl ring-4 ring-blue-200 transition-transform duration-300 group-hover:scale-100 dark:ring-blue-800">
                    <span className="border-0 bg-blue-500 text-sm font-semibold text-white">
                      ⏳ Pending
                    </span>
                  </div>
                </div>
              )}

              {/* XP indicator - simple and clean */}
              <div className="absolute bottom-2 right-2 z-10 rounded border border-border bg-background/90 px-2 py-1 shadow-sm">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">
                    {tile.weight}
                  </span>
                </div>
              </div>

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80">
                  <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
                </div>
              )}
            </>
          )}
          {tile.isHidden && !isLocked && isManagement && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
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
              <h4 className="flex-1 break-words text-base font-semibold leading-tight">
                {tile.title}
              </h4>
              <div className="flex flex-shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 dark:bg-amber-900/30">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{tile.weight} XP</span>
              </div>
            </div>

            {currentTeamSubmission && (
              <div className="flex items-center gap-2 rounded-lg bg-secondary/30 p-2">
                {renderStatusIcon(currentTeamSubmission.status)}
                <span className="text-sm font-medium capitalize">
                  {currentTeamSubmission.status?.replace("_", " ")}
                </span>
              </div>
            )}

            {tile.description && (
              <div className="prose prose-sm max-w-none text-sm text-muted-foreground dark:prose-invert">
                <Markdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-2 break-words leading-relaxed last:mb-0">
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
                      <li className="break-words text-sm">{children}</li>
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
              <div className="mt-2 flex items-center gap-1.5 rounded bg-secondary p-1.5 text-xs">
                <EyeOff className="h-3.5 w-3.5" />
                <span className="font-medium">Hidden tile</span>
              </div>
            )}
          </div>
        </HoverCardContent>
      )}
    </HoverCard>
  )
}
