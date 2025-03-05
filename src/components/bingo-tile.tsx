"use client"

import React from "react"
import Image from "next/image"
import { Check, Clock, Send, X } from "lucide-react"
import type { Tile } from "@/app/actions/events"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

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
    switch (status) {
      case "accepted":
        return <Check className="h-6 w-6 text-green-500" />
      case "requires_interaction":
        return <Clock className="h-6 w-6 text-yellow-500" />
      case "declined":
        return <X className="h-6 w-6 text-red-500" />
      case "pending":
        return <Send className="h-6 w-6 text-blue-500" />
      default:
        return null
    }
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

  // Only show tooltip if tile is not hidden or if user has management rights
  const shouldShowTooltip = !tile.isHidden || (tile.isHidden && isManagement && !isLocked)

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={tileClasses} onClick={handleClick}>
            {!tile.isHidden && (
              <>
                {tile.headerImage ? (
                  <Image
                    unoptimized
                    src={tile.headerImage || "/placeholder.svg"}
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
                  <div className="absolute top-2 left-2 z-10">{renderStatusIcon(currentTeamSubmission.status)}</div>
                )}
              </>
            )}
            {tile.isHidden && !isLocked && isManagement && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-400">Click to reveal</div>
            )}
          </div>
        </TooltipTrigger>
        {shouldShowTooltip && (
          <TooltipContent side="top" align="center" className="max-w-xs p-3">
            <div className="space-y-1">
              <p className="font-semibold">{tile.title}</p>
              <p className="text-sm text-gray-500">{formatDescription(tile.description)}</p>
              {tile.weight && <p className="text-xs font-medium text-amber-600">{tile.weight} XP</p>}
            </div>
          </TooltipContent>
        )}
      </Tooltip>
    </TooltipProvider>
  )
}

