"use client"

import React from "react"
import Image from "next/image"
import { Zap, EyeOff } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import getRandomFrog from "@/lib/getRandomFrog"
import { Badge } from "./ui/badge"

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  userRole: "participant" | "management" | "admin"
  currentTeamId?: string
  isLocked: boolean
  isLoading?: boolean
}

export function BingoTile({ tile, onClick, onTogglePlaceholder, userRole, currentTeamId, isLocked, isLoading = false }: BingoTileProps) {
  const isManagement = userRole === "management" || userRole === "admin"

  const submissionCounts = React.useMemo(() => {
    if (!isManagement || !tile.teamTileSubmissions) return null

    return tile.teamTileSubmissions.reduce(
      (acc, tts) => {
        acc[tts.status]++
        return acc
      },
      { approved: 0, pending: 0, needs_review: 0 },
    )
  }, [isManagement, tile.teamTileSubmissions])

  const currentTeamSubmission = React.useMemo(() => {
    if (!currentTeamId || !tile.teamTileSubmissions) return null
    return tile.teamTileSubmissions.find((tts) => tts.teamId === currentTeamId)
  }, [currentTeamId, tile.teamTileSubmissions])

  const renderStatusIcon = (status: "approved" | "needs_review" | "pending" | undefined) => {
    const iconMap = {
      approved: <div className="bg-green-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-green-200 dark:ring-green-800 transition-all duration-300">
        <span className="text-sm font-bold">✓</span>
      </div>,
      needs_review: <div className="bg-yellow-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-yellow-200 dark:ring-yellow-800 transition-all duration-300">
        <span className="text-sm font-bold">!</span>
      </div>,
      pending: <div className="bg-blue-500 text-white rounded-full w-7 h-7 flex items-center justify-center shadow-lg ring-2 ring-blue-200 dark:ring-blue-800 transition-all duration-300">
        <span className="text-sm font-bold">⏳</span>
      </div>,
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
    ${!tile.isHidden ? `
      border-2 cursor-pointer transform hover:scale-[1.01] sm:hover:scale-[1.02] lg:hover:scale-[1.05] hover:z-10 hover:shadow-2xl
      active:scale-[0.98] active:transition-transform active:duration-100
      ${completionStatus === "completed" ? "border-green-500 bg-green-50 dark:bg-green-900/20 shadow-green-200/50 hover:shadow-green-300/60" : ""}
      ${completionStatus === "needs_review" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 shadow-yellow-200/50 hover:shadow-yellow-300/60" : ""}
      ${completionStatus === "pending" ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 shadow-blue-200/50 hover:shadow-blue-300/60" : ""}
      ${completionStatus === "incomplete" ? "border-muted-foreground/40 hover:border-primary shadow-md hover:shadow-xl" : ""}
    ` : ""}
  `

  const handleClick = () => {
    if (tile.isHidden && !isLocked && isManagement) {
      onTogglePlaceholder(tile)
    } else if (!tile.isHidden || !isLocked) {
      onClick(tile)
    }
  }

  // Format description for tooltip - strip markdown and limit length
  const formatDescription = (description: string | undefined) => {
    if (!description) return "No description available"

    // Strip basic markdown formatting
    const strippedMarkdown = description
      .replace(/\*\*(.*?)\*\*/g, "$1") // Bold
      .replace(/\*(.*?)\*/g, "$1") // Italic
      .replace(/\[(.*?)\]$$(.*?)$$/g, "$1") // Links
      .replace(/#{1,6}\s(.*)/g, "$1") // Headers

    // Limit length and add ellipsis if needed
    return strippedMarkdown.length > 150 ? strippedMarkdown.substring(0, 150) + "..." : strippedMarkdown
  }

  // Only show hover card if tile is not hidden or if user has management rights
  const shouldShowHoverCard = !tile.isHidden || (tile.isHidden && isManagement && !isLocked)

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        <div 
          className={`${tileClasses} focus:outline-none focus:ring-2 sm:focus:ring-4 focus:ring-primary/50 focus:ring-offset-1 sm:focus:ring-offset-2 focus:ring-offset-background focus:scale-[1.01] sm:focus:scale-[1.02] lg:focus:scale-105`} 
          onClick={handleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              handleClick()
            }
          }}
          aria-label={`Bingo tile: ${tile.title}. Worth ${tile.weight} points. Current status: ${completionStatus === 'completed' ? 'Completed' : completionStatus === 'pending' ? 'Pending review' : completionStatus === 'needs_review' ? 'Needs review' : 'Not started'}. ${tile.description ? `Description: ${tile.description.substring(0, 100)}...` : ''}`}
          aria-describedby={tile.description ? `tile-desc-${tile.id}` : undefined}
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
                    completionStatus === "completed" ? "brightness-110 saturate-110" : 
                    completionStatus === "needs_review" ? "brightness-95 saturate-95" : 
                    completionStatus === "pending" ? "brightness-100 saturate-100" : 
                    "brightness-100 saturate-100 group-hover:brightness-110"
                  }`}
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center transition-all duration-300 ${
                  completionStatus === "completed" ? "bg-green-500" : 
                  completionStatus === "needs_review" ? "bg-yellow-500" : 
                  completionStatus === "pending" ? "bg-blue-500" : 
                  "bg-primary group-hover:bg-primary/90"
                }`}>
                  <span className="text-primary-foreground text-lg font-semibold text-center px-2">{tile.title}</span>
                </div>
              )}
              {/* Progress indicator overlay - only show on hover with enhanced animations */}
              {completionStatus === "completed" && (
                <div className="absolute inset-0 bg-green-500/15 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-green-500 text-white rounded-full p-3 shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300 ring-4 ring-green-200 dark:ring-green-800">
                    <span className="bg-green-500 text-white text-sm font-semibold border-0">✓ Complete</span>
                  </div>
                </div>
              )}
              {completionStatus === "needs_review" && (
                <div className="absolute inset-0 bg-yellow-500/15 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-yellow-500 text-white rounded-full p-3 shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300 ring-4 ring-yellow-200 dark:ring-yellow-800">
                    <span className="bg-yellow-500 text-white text-sm font-semibold border-0">⚠ Review</span>
                  </div>
                </div>
              )}
              {completionStatus === "pending" && (
                <div className="absolute inset-0 bg-blue-500/15 opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center backdrop-blur-sm">
                  <div className="bg-blue-500 text-white rounded-full p-3 shadow-2xl transform scale-90 group-hover:scale-100 transition-transform duration-300 ring-4 ring-blue-200 dark:ring-blue-800">
                    <span className="bg-blue-500 text-white text-sm font-semibold border-0">⏳ Pending</span>
                  </div>
                </div>
              )}
              
              {/* XP indicator - simple and clean */}
              <div className="absolute bottom-2 right-2 z-10 bg-background/90 border border-border rounded px-2 py-1 shadow-sm">
                <div className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-amber-500" />
                  <span className="text-xs font-medium text-foreground">{tile.weight}</span>
                </div>
              </div>
              
              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-30">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                </div>
              )}
            </>
          )}
          {tile.isHidden && !isLocked && isManagement && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">Click to reveal</div>
          )}
        </div>
      </HoverCardTrigger>
      {shouldShowHoverCard && (
        <HoverCardContent side="right" align="start" className="w-80 p-4">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <h4 className="font-semibold text-base flex-1">{tile.title}</h4>
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full flex-shrink-0">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{tile.weight} XP</span>
              </div>
            </div>

            {currentTeamSubmission && (
              <div className="flex items-center gap-2 p-2 bg-secondary/30 rounded-lg">
                {renderStatusIcon(currentTeamSubmission.status)}
                <span className="text-sm font-medium capitalize">{currentTeamSubmission.status?.replace("_", " ")}</span>
              </div>
            )}

            {tile.description && <p className="text-sm text-muted-foreground">{tile.description}</p>}

            {tile.goals && tile.goals.length > 0 && (
              <div className="pt-1">
                <h5 className="text-xs font-semibold mb-2">Goals:</h5>
                <ul className="text-xs space-y-1">
                  {tile.goals.map((goal, idx) => (
                    <li key={idx} className="flex justify-between items-center p-1 bg-muted/30 rounded">
                      <span className="text-muted-foreground">{goal.description}</span>
                      <span className="font-medium">Target: {goal.targetValue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {tile.isHidden && (
              <div className="mt-2 text-xs bg-secondary p-1.5 rounded flex items-center gap-1.5">
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

