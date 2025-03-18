"use client"

import React from "react"
import Image from "next/image"
import { Check, Clock, Send, X, Zap, EyeOff } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import getRandomFrog from "@/lib/getRandomFrog"

interface BingoTileProps {
  tile: Tile
  onClick: (tile: Tile) => void
  onTogglePlaceholder: (tile: Tile) => void
  userRole: "participant" | "management" | "admin"
  currentTeamId?: string
  isLocked: boolean
}

export function BingoTile({ tile, onClick, onTogglePlaceholder, userRole, currentTeamId, isLocked }: BingoTileProps) {
  const isManagement = userRole === "management" || userRole === "admin"

  const submissionCounts = React.useMemo(() => {
    if (!isManagement || !tile.teamTileSubmissions) return null

    return tile.teamTileSubmissions.reduce(
      (acc, tts) => {
        acc[tts.status]++
        return acc
      },
      { accepted: 0, pending: 0, requires_interaction: 0, declined: 0 },
    )
  }, [isManagement, tile.teamTileSubmissions])

  const currentTeamSubmission = React.useMemo(() => {
    if (!currentTeamId || !tile.teamTileSubmissions) return null
    return tile.teamTileSubmissions.find((tts) => tts.teamId === currentTeamId)
  }, [currentTeamId, tile.teamTileSubmissions])

  const renderStatusIcon = (status: "accepted" | "requires_interaction" | "declined" | "pending" | undefined) => {
    const iconMap = {
      accepted: <Check className="h-5 w-5 text-green-500" />,
      requires_interaction: <Clock className="h-5 w-5 text-yellow-500" />,
      declined: <X className="h-5 w-5 text-red-500" />,
      pending: <Send className="h-5 w-5 text-blue-500" />,
    }
    return status ? iconMap[status] : null
  }

  const tileClasses = `
    relative rounded overflow-hidden aspect-square
    ${tile.isHidden && isLocked ? "bg-transparent" : ""}
    ${tile.isHidden && !isLocked ? "border-2 border-dashed border-gray-300 bg-gray-100 cursor-pointer" : ""}
    ${!tile.isHidden ? "border-2 border-primary cursor-pointer transition-transform duration-300 ease-in-out hover:scale-105" : ""}
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
        <div className={tileClasses} onClick={handleClick}>
          {!tile.isHidden && (
            <>
              {tile.headerImage ? (
                <Image
                  unoptimized
                  src={tile.headerImage || getRandomFrog()}
                  alt={tile.title}
                  fill
                  className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                />
              ) : (
                <div className="w-full h-full bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
                </div>
              )}
              {currentTeamSubmission && (
                <div className="absolute top-1 right-1 z-10 bg-background/80 rounded-full p-0.5">
                  {renderStatusIcon(currentTeamSubmission.status)}
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
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-base">{tile.title}</h4>
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded-full">
                <Zap className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs font-medium">{tile.weight} XP</span>
              </div>
            </div>

            {tile.description && <p className="text-sm text-muted-foreground">{tile.description}</p>}

            {tile.goals && tile.goals.length > 0 && (
              <div className="pt-1">
                <h5 className="text-xs font-semibold mb-1">Goals:</h5>
                <ul className="text-xs space-y-1">
                  {tile.goals.map((goal, idx) => (
                    <li key={idx} className="flex justify-between">
                      <span className="text-muted-foreground">{goal.description}</span>
                      <span className="font-medium">Target: {goal.targetValue}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {currentTeamSubmission && (
              <div className="pt-1 border-t">
                <div className="flex items-center gap-2">
                  {renderStatusIcon(currentTeamSubmission.status)}
                  <span className="text-xs capitalize">{currentTeamSubmission.status?.replace("_", " ")}</span>
                </div>
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

