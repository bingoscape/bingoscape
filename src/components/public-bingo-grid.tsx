"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, Users, Zap } from "lucide-react"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import getRandomFrog from "@/lib/getRandomFrog"
import type { PublicTeamData } from "@/app/actions/public-events"
import { useSwipeable } from "react-swipeable"
import { useRouter } from "next/navigation"

interface TileGoal {
  id: string
  description: string
  targetValue: number
  currentValue?: number
}

interface Tile {
  id: string
  title: string
  description: string | null
  headerImage: string | null
  index: number
  weight: number
  goals?: TileGoal[]
  isHidden?: boolean
}

interface Bingo {
  id: string
  title: string
  description: string | null
  rows: number
  columns: number
  tiles: Tile[]
}

interface PublicBingoGridProps {
  bingo: Bingo
  teams: PublicTeamData[]
  // Instead of function props, pass the IDs for navigation
  prevBingoId?: string
  nextBingoId?: string
  eventId: string
}

export function PublicBingoGrid({ bingo, teams, prevBingoId, nextBingoId, eventId }: PublicBingoGridProps) {
  const router = useRouter()
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(teams.length > 0 ? teams[0]!.id : undefined)
  const [teamIndex, setTeamIndex] = useState(0)
  const [openTooltipIndex, setOpenTooltipIndex] = useState<number | null>(null)

  // Update team index when selectedTeamId changes
  useEffect(() => {
    const index = teams.findIndex((team) => team.id === selectedTeamId)
    if (index !== -1) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional sync of derived state
      setTeamIndex(index)
    }
  }, [selectedTeamId, teams])

  // Handle team navigation
  const navigateTeam = (direction: "prev" | "next") => {
    const newIndex =
      direction === "prev" ? (teamIndex - 1 + teams.length) % teams.length : (teamIndex + 1) % teams.length

    setTeamIndex(newIndex)
    setSelectedTeamId(teams[newIndex]?.id)
  }

  // Handle board navigation
  const navigateBoard = (direction: "prev" | "next") => {
    const targetId = direction === "prev" ? prevBingoId : nextBingoId
    if (targetId) {
      router.push(`/public/events/${eventId}/bingos/${targetId}`)
    }
  }

  // Set up swipe handlers
  const swipeHandlers = useSwipeable({
    onSwipedLeft: () => teams.length > 1 && navigateTeam("next"),
    onSwipedRight: () => teams.length > 1 && navigateTeam("prev"),
    trackMouse: true,
  })

  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const completedTiles = selectedTeam?.completedTiles ?? []
  const inProgressTiles = selectedTeam?.inProgressTiles ?? []

  // If no teams, show empty state
  if (teams.length === 0) {
    return (
      <div className="space-y-6">
        <div className="aspect-square w-full max-w-[80vh] mx-auto">
          <div
            className="grid gap-2 h-full"
            style={{
              gridTemplateColumns: `repeat(${bingo.columns}, minmax(0, 1fr))`,
              gridTemplateRows: `repeat(${bingo.rows}, minmax(0, 1fr))`,
            }}
          >
            {bingo.tiles.map((tile) => (
              <Card key={tile.id} className="overflow-hidden aspect-square relative border-2 border-primary">
                {tile.headerImage ? (
                  <Image
                    src={tile.headerImage ?? getRandomFrog()}
                    alt={tile.title}
                    fill
                    className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                  />
                ) : (
                  <div className="w-full h-full bg-primary flex items-center justify-center">
                    <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>

        {(prevBingoId ?? nextBingoId) && (
          <div className="flex justify-between mt-6">
            <Button variant="outline" onClick={() => navigateBoard("prev")} disabled={!prevBingoId}>
              <ChevronLeft className="mr-2 h-4 w-4" /> Previous Board
            </Button>
            <Button variant="outline" onClick={() => navigateBoard("next")} disabled={!nextBingoId}>
              Next Board <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {teams.length > 0 && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" />
            <span className="font-medium">Team Progress:</span>
          </div>

          <div className="flex items-center justify-center w-full gap-4">
            <Button variant="outline" size="icon" onClick={() => navigateTeam("prev")} disabled={teams.length <= 1}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="text-center min-w-[180px]">
              <h3 className="text-lg font-semibold">{selectedTeam?.name}</h3>
              <div className="flex flex-col items-center gap-1">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-green-600 dark:text-green-400">{completedTiles.length}</span>{" "}
                  completed,
                  <span className="font-medium text-amber-600 dark:text-amber-400 ml-1">{inProgressTiles.length}</span>{" "}
                  in progress
                </p>
              </div>
            </div>

            <Button variant="outline" size="icon" onClick={() => navigateTeam("next")} disabled={teams.length <= 1}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {teams.length > 1 && (
            <div className="flex justify-center gap-1 mt-2">
              {teams.map((team, idx) => (
                <Button
                  key={team.id}
                  variant="ghost"
                  size="sm"
                  className={`w-2 h-2 p-0 rounded-full ${idx === teamIndex ? "bg-primary" : "bg-muted"}`}
                  onClick={() => {
                    setTeamIndex(idx)
                    setSelectedTeamId(team.id)
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="aspect-square w-full max-w-[80vh] mx-auto" {...swipeHandlers}>
        <div
          className="grid gap-2 h-full"
          style={{
            gridTemplateColumns: `repeat(${bingo.columns}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${bingo.rows}, minmax(0, 1fr))`,
          }}
        >
          {bingo.tiles.map((tile, index) => {
            const isCompleted = completedTiles.includes(tile.id)
            const isInProgress = inProgressTiles.includes(tile.id)

            return (
              <div key={tile.id} className="relative">
                <HoverCard openDelay={200} closeDelay={100} open={index === openTooltipIndex}>
                  <HoverCardTrigger asChild>
                    <Card
                      className={`overflow-hidden aspect-square relative cursor-pointer ${isCompleted
                        ? "border-2 border-green-500 dark:border-green-400"
                        : isInProgress
                          ? "border-2 border-amber-500 dark:border-amber-400"
                          : "border-2 border-primary"
                        }`}
                      onClick={() => setOpenTooltipIndex(index === openTooltipIndex ? null : index)}
                    >
                      {tile.headerImage ? (
                        <div className="relative w-full h-full">
                          <Image
                            src={tile.headerImage || getRandomFrog()}
                            alt={tile.title}
                            fill
                            className="object-contain transition-transform duration-300 ease-in-out hover:scale-110"
                          />
                          {isCompleted && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <div className="bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold transform rotate-[-20deg]">
                                COMPLETED
                              </div>
                            </div>
                          )}
                          {isInProgress && !isCompleted && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <div className="bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-bold transform rotate-[-20deg]">
                                IN PROGRESS
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="w-full h-full bg-primary flex items-center justify-center">
                          <span className="text-primary-foreground text-lg font-semibold">{tile.title}</span>
                          {isCompleted && (
                            <div className="absolute inset-0 bg-green-500/20 flex items-center justify-center">
                              <div className="bg-green-500 text-white px-2 py-1 rounded-md text-xs font-bold transform rotate-[-20deg]">
                                COMPLETED
                              </div>
                            </div>
                          )}
                          {isInProgress && !isCompleted && (
                            <div className="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                              <div className="bg-amber-500 text-white px-2 py-1 rounded-md text-xs font-bold transform rotate-[-20deg]">
                                IN PROGRESS
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </Card>
                  </HoverCardTrigger>
                  <HoverCardContent className="w-80 p-4 bg-[#1e293b] border-[#677da2]" side="left">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-semibold">{tile.title}</h4>
                        <div className="flex items-center gap-1 px-2 py-1 bg-amber-900/30 rounded-full">
                          <Zap className="h-3.5 w-3.5 text-amber-500" />
                          <span className="text-xs font-medium">{tile.weight} XP</span>
                        </div>
                      </div>

                      {tile.description && <p className="text-sm text-[#677da2] line-clamp-3">{tile.description}</p>}

                      {tile.goals && tile.goals.length > 0 && (
                        <div className="pt-2">
                          <h5 className="text-xs font-semibold mb-1">Goals:</h5>
                          <ul className="text-xs space-y-1">
                            {tile.goals.map((goal, idx) => (
                              <li key={idx} className="flex justify-between">
                                <span className="text-[#677da2]">{goal.description}</span>
                                <span className="font-medium">Target: {goal.targetValue}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Status indicator */}
                      {(isCompleted || isInProgress) && (
                        <div className="mt-2 text-xs p-1.5 rounded flex items-center gap-2">
                          <div
                            className={`w-2 h-2 rounded-full ${isCompleted ? "bg-green-500" : "bg-amber-500"}`}
                          ></div>
                          <span className="font-medium">Status: {isCompleted ? "Completed" : "In Progress"}</span>
                        </div>
                      )}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              </div>
            )
          })}
        </div>
      </div>

      {(prevBingoId ?? nextBingoId) && (
        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => navigateBoard("prev")} disabled={!prevBingoId}>
            <ChevronLeft className="mr-2 h-4 w-4" /> Previous Board
          </Button>
          <Button variant="outline" onClick={() => navigateBoard("next")} disabled={!nextBingoId}>
            Next Board <ChevronRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
