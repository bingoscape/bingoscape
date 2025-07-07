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
import { ListFilter } from "lucide-react"
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

  // Determine which team's data to show
  const effectiveTeamId = isAdminOrManagement ? selectedTeamId : currentTeam?.id

  // Filter bingos based on user role and visibility
  const visibleBingos = event.bingos?.filter((bingo: any) => isAdminOrManagement || bingo.visible === true) ?? []

  const bingoCount = visibleBingos.length
  const gridClass = bingoCount <= 1 ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-2"
  const cardClass = bingoCount <= 1 ? "max-w-3xl" : ""

  return (
    <>
      <div className="flex justify-between items-center mt-6 mb-4">
        <h2 className="text-2xl font-bold">Bingos</h2>
        {isAdminOrManagement && event.teams && event.teams.length > 0 && (
          <TeamSelector
            teams={event.teams}
            currentTeamId={currentTeam?.id}
            userRole={userRole}
            selectedTeamId={selectedTeamId}
            onTeamChange={setSelectedTeamId}
          />
        )}
      </div>

      {visibleBingos.length === 0 ? (
        <p>No bingos have been created for this event yet.</p>
      ) : (
        <div className={`grid ${gridClass} gap-6`}>
          {visibleBingos.map((bingo: any) => (
            <Card key={bingo.id} className={cardClass}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>{bingo.title}</CardTitle>
                  <div className="flex space-x-2">
                    <BingoInfoModal bingo={bingo} />
                    {isAdminOrManagement && (
                      <>
                        <EditBingoModal bingo={bingo} />
                        <DeleteBingoButton bingoId={bingo.id as UUID} />
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <BingoGrid
                    bingo={bingo}
                    currentTeamId={effectiveTeamId}
                    teams={event.teams ?? []}
                    highlightedTiles={[]}
                    isLayoutLocked={true}
                    userRole={userRole}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Link href={`/events/${bingo.eventId}/bingos/${bingo.id}`} passHref>
                  <Button variant="outline">View Bingo</Button>
                </Link>
                {isAdminOrManagement && (
                  <Link href={`/events/${bingo.eventId}/bingos/${bingo.id}/submissions`} passHref>
                    <Button variant="outline" className="flex items-center gap-2">
                      <ListFilter className="h-4 w-4" />
                      Submissions
                    </Button>
                  </Link>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </>
  )
}
