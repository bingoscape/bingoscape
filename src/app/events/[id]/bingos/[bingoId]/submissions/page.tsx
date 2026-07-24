/* eslint-disable */
"use client"

import { useState, useEffect, use } from "react"
import { useRouter } from "next/navigation"
import { getUserRole } from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import { getAllSubmissionsForTeam, updateTeamTileSubmissionStatus, updateSubmissionStatus, deleteSubmission } from "@/app/actions/bingo"
import { getBingoById } from "@/app/actions/getBingoById"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "@/hooks/use-toast"
import { ArrowLeft, RefreshCw } from "lucide-react"
import { getEventById } from "@/server/queries/events"
import type { BingoData, TeamTileSubmission } from "@/types/model"
import { SubmissionsTab } from "@/components/submissions-tab"
import { FullSizeImageDialog } from "@/components/full-size-image-dialog"

export default function BingoSubmissionsPage(props: {
  params: Promise<{ id: string; bingoId: string }>
}) {
  const params = use(props.params)
  const { id: eventId, bingoId } = params
  const router = useRouter()
  
  const [loading, setLoading] = useState(true)
  const [bingo, setBingo] = useState<BingoData | null>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [userRole, setUserRole] = useState<"participant" | "management" | "admin" | null>(null)
  const [tileSubmissions, setTileSubmissions] = useState<TeamTileSubmission[]>([])
  const [refreshKey, setRefreshKey] = useState(0)
  const [fullSizeImage, setFullSizeImage] = useState<{ src: string; alt: string } | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        const [eventData, teamsData, userRoleData, bingoData] = await Promise.all([
          getEventById(eventId),
          getTeamsByEventId(eventId),
          getUserRole(eventId),
          getBingoById(bingoId),
        ])

        if (!eventData || !bingoData) {
          router.push(`/events/${eventId}`)
          return
        }

        setBingo(bingoData)
        setTeams(teamsData)
        setUserRole(userRoleData)
        
        // Fetch submissions for all teams
        const allTeamSubmissions: TeamTileSubmission[] = []
        await Promise.all(
          teamsData.map(async (team: any) => {
            const teamSubMap = await getAllSubmissionsForTeam(bingoId, team.id)
            Object.values(teamSubMap).forEach((subsArray) => {
              if (Array.isArray(subsArray)) {
                allTeamSubmissions.push(...subsArray)
              }
            })
          })
        )
        
        setTileSubmissions(allTeamSubmissions)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({ title: "Error", description: "Failed to fetch data", variant: "destructive" })
      } finally {
        setLoading(false)
      }
    }

    fetchData().catch(console.error)
  }, [eventId, bingoId, router, refreshKey])

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1)
  }

  const isAdminOrManagement = userRole === "admin" || userRole === "management"

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
            <h1 className="text-2xl font-bold">
              {bingo?.title} - Tile Submissions
            </h1>
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
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array(6).fill(0).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full" />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card shadow-xs min-h-[60vh]">
            <SubmissionsTab
              selectedTile={null}
              teamTileSubmissions={tileSubmissions}
              teams={teams}
              hasSufficientRights={isAdminOrManagement}
              isAdminView={isAdminOrManagement}
              currentTeamId={undefined}
              isSubmissionsLocked={false}
              selectedImage={null}
              pastedImage={null}
              isUploadingImage={false}
              onImageChange={() => {}}
              onImageSubmit={() => {}}
              onFullSizeImageView={(src, alt) => setFullSizeImage({ src, alt })}
              onTeamTileSubmissionStatusUpdate={async (id, status) => {
                if (!id) return
                try {
                  await updateTeamTileSubmissionStatus(id, status)
                  handleRefresh()
                  toast({ title: "Success", description: "Tile status updated." })
                } catch {
                  toast({ title: "Error", description: "Failed to update tile.", variant: "destructive" })
                }
              }}
              onSubmissionStatusUpdate={async (id, status, goalId, submissionValue) => {
                try {
                  await updateSubmissionStatus(id, status, goalId, submissionValue)
                  handleRefresh()
                  toast({ title: "Success", description: "Submission updated successfully." })
                } catch {
                  toast({ title: "Error", description: "Failed to update submission.", variant: "destructive" })
                }
              }}
              onDeleteSubmission={async (id) => {
                try {
                  await deleteSubmission(id)
                  handleRefresh()
                  toast({ title: "Success", description: "Submission deleted." })
                } catch {
                  toast({ title: "Error", description: "Failed to delete submission.", variant: "destructive" })
                }
              }}
            />
          </div>
        )}
      </div>

      {fullSizeImage && (
        <FullSizeImageDialog
          isOpen={!!fullSizeImage}
          onClose={() => setFullSizeImage(null)}
          imageSrc={fullSizeImage.src}
          imageAlt={fullSizeImage.alt}
        />
      )}
    </div>
  )
}
