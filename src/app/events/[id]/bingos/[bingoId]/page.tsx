/* eslint-disable */
"use client"

import { useEffect, useState, use } from "react";
import { notFound, useRouter } from "next/navigation"
import BingoGridWrapper from "@/components/bingo-grid-wrapper"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId, getCurrentTeamForUser } from "@/app/actions/team"
import { Skeleton } from "@/components/ui/skeleton"
import type { UUID } from "crypto"
import { TeamSelector } from "@/components/team-selector"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, RefreshCw, FileJson } from "lucide-react"
import type { Bingo } from "@/app/actions/events"
import { cn } from "@/lib/utils"

export default function BingoDetailPage(props: { params: Promise<{ id: UUID; bingoId: string }> }) {
  const params = use(props.params);
  const { id: eventId, bingoId } = params
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [currentTeam, setCurrentTeam] = useState<any>(null)
  const [userRole, setUserRole] = useState<"participant" | "management" | "admin">("participant")
  const [bingo, setBingo] = useState<Bingo | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>(undefined)
  const [importExportModalOpen, setImportExportModalOpen] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [eventData, teamsData, currentTeamData, userRoleData] = await Promise.all([
          getEventById(eventId),
          getTeamsByEventId(eventId),
          getCurrentTeamForUser(eventId),
          getUserRole(eventId),
        ])

        if (!eventData) {
          notFound()
        }

        setData(eventData)
        setTeams(teamsData)
        setCurrentTeam(currentTeamData)
        setUserRole(userRoleData!)

        // Set initial selected team based on user role
        if (userRoleData === "admin" || userRoleData === "management") {
          // Admins and management can start with any team, default to current team if available
          setSelectedTeamId(currentTeamData?.id || teamsData[0]?.id)
        } else {
          // Participants can only see their own team
          setSelectedTeamId(currentTeamData?.id)
        }

        const foundBingo = eventData.event.bingos!.find((b: any) => b.id == bingoId)
        if (!foundBingo) {
          notFound()
        }
        setBingo(foundBingo)
      } catch (error) {
        console.error("Error fetching bingo data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
      
      .catch((error) => console.error("Error fetching bingo data:", error))
  }, [eventId, bingoId, refreshKey])

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

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-6 w-full mb-6" />
        <Skeleton className="aspect-square w-full max-w-[80vh] mx-auto" />
      </div>
    )
  }

  if (!data || !bingo) {
    return <div className="container mx-auto px-4 py-8">Bingo not found</div>
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/events" },
    { label: data.event.title, href: `/events/${eventId}` },
    { label: bingo.title, href: `/events/${eventId}/bingos/${bingoId}` },
  ]

  return (
    <div className="container mx-auto px-4 py-4">
      <div className="flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => router.push(`/events/${eventId}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{bingo.title}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh">
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
            <div className={cn(
              "w-full mx-auto",
              bingo.bingoType === "progression" ? "max-w-full" : "aspect-square max-w-[80vh]"
            )}>
              <BingoGridWrapper
                key={`bingo-${refreshKey}-${effectiveTeamId}`}
                bingo={bingo}
                userRole={userRole}
                currentTeamId={effectiveTeamId}
                teams={teams}
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
