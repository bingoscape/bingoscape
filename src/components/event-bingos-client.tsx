/* eslint-disable */
"use client"

import { useState } from "react"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import BingoGrid from "@/components/bingogrid"
import { DeleteBingoButton } from "@/components/delete-bingo-button"
import { BingoInfoModal } from "@/components/bingo-info-modal"
import { EditBingoModal } from "@/components/edit-bingo-modal"
import { TeamSelector } from "@/components/team-selector"
import Link from "next/link"
import { ListFilter, ChevronLeft, ChevronRight } from "lucide-react"
import type { UUID } from "crypto"

interface EventBingosClientProps {
  event: any
  userRole: "admin" | "management" | "participant"
  currentTeam: any
  isAdminOrManagement: boolean
}

export function EventBingosClient({ event, userRole, currentTeam, isAdminOrManagement }: EventBingosClientProps) {
  // State for team selection (only for admins/management)
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(currentTeam?.id)
  // State for current bingo index
  const [currentBingoIndex, setCurrentBingoIndex] = useState(0)

  // Determine which team's data to show
  const effectiveTeamId = isAdminOrManagement ? selectedTeamId : currentTeam?.id

  // Filter bingos based on user role and visibility
  const visibleBingos = event.bingos?.filter((bingo: any) => isAdminOrManagement || bingo.visible === true) ?? []

  // Get current bingo based on index
  const currentBingo = visibleBingos[currentBingoIndex]

  // Calculate completion statistics for each bingo
  const getBingoStats = (bingo: any) => {
    if (!bingo?.tiles || !effectiveTeamId) {
      return { completed: 0, pending: 0, needsReview: 0, total: bingo?.tiles?.length || 0 }
    }

    const stats = { completed: 0, pending: 0, needsReview: 0, total: bingo.tiles.length }

    bingo.tiles.forEach((tile: any) => {
      const teamSubmission = tile.teamTileSubmissions?.find((tts: any) => tts.teamId === effectiveTeamId)
      if (teamSubmission) {
        if (teamSubmission.status === "approved") stats.completed++
        else if (teamSubmission.status === "pending") stats.pending++
        else if (teamSubmission.status === "needs_review") stats.needsReview++
      }
    })

    return stats
  }

  const nextBingo = () => {
    if (visibleBingos.length > 1) {
      setCurrentBingoIndex((prev) => (prev + 1) % visibleBingos.length)
    }
  }

  const prevBingo = () => {
    if (visibleBingos.length > 1) {
      setCurrentBingoIndex((prev) => (prev - 1 + visibleBingos.length) % visibleBingos.length)
    }
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mt-6 mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold">Bingos</h2>
            <p className="text-muted-foreground text-sm mt-1">
              {visibleBingos.length} bingo{visibleBingos.length !== 1 ? "s" : ""} available
            </p>
          </div>
          {visibleBingos.length > 1 && (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={prevBingo} disabled={visibleBingos.length <= 1}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm text-muted-foreground">
                {currentBingoIndex + 1} of {visibleBingos.length}
              </span>
              <Button variant="outline" size="sm" onClick={nextBingo} disabled={visibleBingos.length <= 1}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
        {isAdminOrManagement && event.teams && event.teams.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">View Team:</span>
            <TeamSelector
              teams={event.teams}
              currentTeamId={currentTeam?.id}
              userRole={userRole}
              selectedTeamId={selectedTeamId}
              onTeamChange={setSelectedTeamId}
            />
          </div>
        )}
      </div>

      {visibleBingos.length === 0 ? (
        <div className="text-center py-12">
          <div className="mx-auto w-24 h-24 rounded-full bg-muted flex items-center justify-center mb-4">
            <ListFilter className="h-12 w-12 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No bingos available</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            {isAdminOrManagement
              ? "Create your first bingo to get started with this event."
              : "The event organizers haven't created any bingos yet. Check back later!"}
          </p>
        </div>
      ) : currentBingo ? (
        <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <CardTitle className="text-xl font-bold">{currentBingo.title}</CardTitle>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-muted-foreground">
                      {Math.round((getBingoStats(currentBingo).completed / getBingoStats(currentBingo).total) * 100) ||
                        0}
                      %
                    </span>
                    <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600 transition-all duration-300"
                        style={{
                          width: `${Math.round((getBingoStats(currentBingo).completed / getBingoStats(currentBingo).total) * 100) || 0}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
                {currentBingo.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{currentBingo.description}</p>
                )}
                {/* Simple team statistics */}
                {effectiveTeamId && (
                  <div className="flex items-center gap-4 mt-3 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-green-600 dark:text-green-400 font-medium">
                        {getBingoStats(currentBingo).completed} completed
                      </span>
                    </div>
                    {getBingoStats(currentBingo).pending > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                        <span className="text-blue-600 dark:text-blue-400 font-medium">
                          {getBingoStats(currentBingo).pending} pending
                        </span>
                      </div>
                    )}
                    {getBingoStats(currentBingo).needsReview > 0 && (
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                        <span className="text-yellow-600 dark:text-yellow-400 font-medium">
                          {getBingoStats(currentBingo).needsReview} review
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-muted-foreground rounded-full"></div>
                      <span className="text-muted-foreground font-medium">
                        {getBingoStats(currentBingo).total -
                          getBingoStats(currentBingo).completed -
                          getBingoStats(currentBingo).pending -
                          getBingoStats(currentBingo).needsReview}{" "}
                        remaining
                      </span>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex space-x-1 ml-4">
                <BingoInfoModal bingo={currentBingo} />
                {isAdminOrManagement && (
                  <>
                    <EditBingoModal bingo={currentBingo} />
                    <DeleteBingoButton bingoId={currentBingo.id as UUID} />
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="relative bg-muted/20 rounded-lg p-2 border border-muted/40">
              <BingoGrid
                key={currentBingo.id} // Add key to force re-render when bingo changes
                bingo={currentBingo}
                currentTeamId={effectiveTeamId}
                teams={event.teams ?? []}
                highlightedTiles={[]}
                isLayoutLocked={true}
                userRole={userRole}
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row justify-between gap-3 pt-4">
            <Link href={`/events/${currentBingo.eventId}/bingos/${currentBingo.id}`} passHref>
              <Button variant="default" className="w-full sm:w-auto">
                View Bingo
              </Button>
            </Link>
            {isAdminOrManagement && (
              <Link href={`/events/${currentBingo.eventId}/bingos/${currentBingo.id}/submissions`} passHref>
                <Button variant="outline" className="w-full sm:w-auto flex items-center gap-2 bg-transparent">
                  <ListFilter className="h-4 w-4" />
                  Submissions
                </Button>
              </Link>
            )}
          </CardFooter>
        </Card>
      ) : null}
    </>
  )
}

