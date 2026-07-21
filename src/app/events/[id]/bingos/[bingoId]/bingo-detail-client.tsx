/* eslint-disable */
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import BingoGridWrapper from "@/components/bingo-grid-wrapper"
import { TeamSelector } from "@/components/team-selector"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw, FileJson } from "lucide-react"
import { cn } from "@/lib/utils"

export function BingoDetailClient({
  eventId,
  bingoId,
  eventData,
  teamsData,
  currentTeamData,
  userRoleData,
  bingo,
}: {
  eventId: string
  bingoId: string
  eventData: any
  teamsData: any[]
  currentTeamData: any
  userRoleData: "participant" | "management" | "admin"
  bingo: any
}) {
  const router = useRouter()
  const [refreshKey, setRefreshKey] = useState(0)

  // Set initial selected team based on user role
  const initialSelectedTeamId =
    userRoleData === "admin" || userRoleData === "management"
      ? currentTeamData?.id || teamsData[0]?.id
      : currentTeamData?.id

  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    initialSelectedTeamId
  )
  const [importExportModalOpen, setImportExportModalOpen] = useState(false)

  const data = eventData
  const teams = teamsData
  const currentTeam = currentTeamData
  const userRole = userRoleData

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const handleTeamChange = (teamId: string | undefined) => {
    // Only allow team changes for admins and management
    if (userRole === "admin" || userRole === "management") {
      setSelectedTeamId(teamId)
    }
  }

  const isAdminOrManagement = userRole === "admin" || userRole === "management"

  // Determine which team ID to use for the bingo grid
  const effectiveTeamId = isAdminOrManagement ? selectedTeamId : currentTeam?.id

  if (!data || !bingo) {
    return <div className="container mx-auto px-4 py-8">Bingo not found</div>
  }

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push(`/events/${eventId}`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{bingo.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            {isAdminOrManagement && teams.length > 0 && (
              <TeamSelector
                teams={teams}
                currentTeamId={currentTeam?.id}
                userRole={userRole}
                onTeamChange={handleTeamChange}
                selectedTeamId={selectedTeamId}
              />
            )}
            {isAdminOrManagement && (
              <Button
                variant="outline"
                onClick={() => setImportExportModalOpen(true)}
              >
                <FileJson className="mr-2 h-4 w-4" />
                Import/Export
              </Button>
            )}
          </div>
        </div>

        <Card className="border-none shadow-xs">
          <CardContent className="p-2 sm:p-4">
            <div
              className={cn(
                "mx-auto w-full",
                bingo.bingoType === "progression"
                  ? "max-w-full"
                  : "aspect-square max-w-[80vh]"
              )}
            >
              <BingoGridWrapper
                key={`bingo-${refreshKey}-${effectiveTeamId}`}
                bingo={bingo}
                userRole={userRole}
                currentTeamId={effectiveTeamId}
                teams={teams}
                gameType={data.event.gameType}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Import/Export Modal */}
      {isAdminOrManagement && bingo && (
        <BingoImportExportModal
          eventId={eventId}
          bingoId={bingoId}
          bingoTitle={bingo.title}
          isOpen={importExportModalOpen}
          onClose={() => setImportExportModalOpen(false)}
        />
      )}
    </div>
  )
}
