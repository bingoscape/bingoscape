"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import BingoGridWrapper from "@/components/bingo-grid-wrapper"
import { TeamSelector } from "@/components/team-selector"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw, FileJson } from "lucide-react"
import type { Bingo, Team } from "@/app/actions/events"
import { cn } from "@/lib/utils"

interface BingoDetailContentProps {
  eventId: string
  bingoId: string
  gameType: "osrs" | "rs3"
  bingo: Bingo
  teams: Team[]
  currentTeam: { id: string; name: string } | null
  userRole: "participant" | "management" | "admin"
}

export function BingoDetailContent({
  eventId,
  bingoId,
  gameType,
  bingo,
  teams,
  currentTeam,
  userRole,
}: BingoDetailContentProps) {
  const router = useRouter()
  const [importExportModalOpen, setImportExportModalOpen] = useState(false)
  const isAdminOrManagement = userRole === "admin" || userRole === "management"
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(
    isAdminOrManagement
      ? (currentTeam?.id ?? teams[0]?.id)
      : currentTeam?.id
  )

  const handleTeamChange = (teamId: string | undefined) => {
    if (isAdminOrManagement) setSelectedTeamId(teamId)
  }

  const effectiveTeamId = isAdminOrManagement ? selectedTeamId : currentTeam?.id

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
              onClick={() => router.refresh()}
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

        <Card className="border-none shadow-sm">
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
                key={`bingo-${effectiveTeamId}`}
                bingo={bingo}
                userRole={userRole}
                currentTeamId={effectiveTeamId}
                teams={teams}
                gameType={gameType}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {isAdminOrManagement && (
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
