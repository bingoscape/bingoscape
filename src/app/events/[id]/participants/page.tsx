"use client"

import { useState, useEffect, use } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { Loader2, Edit, UserPlus } from "lucide-react"
import {
  getEventParticipants,
  getEventById,
  getRegistrationRequests,
  getPendingRegistrationCount,
} from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { UUID } from "crypto"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useSession } from "next-auth/react"
import { PrizePoolBreakdown } from "@/components/prize-pool-breakdown"
import { PlayerMetadataModal } from "@/components/player-metadata-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ParticipantsTab } from "@/components/participants-tab"
import { RegistrationsTab } from "@/components/registrations-tab"
import type { Participant, Team } from "./types"
import type { RegistrationRequest } from "@/app/actions/events"

export default function EventParticipantsPage(props: {
  params: Promise<{ id: UUID }>
}) {
  const params = use(props.params)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [registrationRequests, setRegistrationRequests] = useState<
    RegistrationRequest[]
  >([])
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [minimumBuyIn, setMinimumBuyIn] = useState(0)
  const [eventName, setEventName] = useState("")
  const { data } = useSession()
  const [currentUserRole, setCurrentUserRole] = useState<
    "admin" | "management" | "participant"
  >("participant")
  const [isEventCreator, setIsEventCreator] = useState(false)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserName, setCurrentUserName] = useState<string | null>(null)
  const [currentUserRunescapeName, setCurrentUserRunescapeName] = useState<
    string | null
  >(null)
  const [pendingCount, setPendingCount] = useState(0)

  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState<string>(
    searchParams.get("tab") ?? "participants"
  )

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [participantsData, teamsData, eventData] = await Promise.all([
          getEventParticipants(params.id as string),
          getTeamsByEventId(params.id as string),
          getEventById(params.id as string),
        ])

        const userParticipant = participantsData.find(
          (p) => p.id === data?.user.id
        )
        const userRole = userParticipant?.role ?? "participant"
        const isCreator = eventData?.event.creatorId === data?.user.id

        setCurrentUserRole(userRole)
        setIsEventCreator(isCreator)
        setParticipants(participantsData)
        setTeams(teamsData)
        setMinimumBuyIn(eventData?.event.minimumBuyIn ?? 0)
        setEventName(eventData?.event.title ?? "")

        // Store current user info for metadata editing
        if (userParticipant) {
          setCurrentUserId(userParticipant.id)
          setCurrentUserName(null)
          setCurrentUserRunescapeName(userParticipant.runescapeName)
        }

        // Fetch registration requests if user has permission
        if (isCreator || userRole === "admin" || userRole === "management") {
          const [requests, pending] = await Promise.all([
            getRegistrationRequests(params.id as string),
            getPendingRegistrationCount(params.id as string),
          ])
          setRegistrationRequests(requests)
          setPendingCount(pending)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load event data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    setLoading(true)
    fetchData().catch((err) => console.error(err))
  }, [params.id, data?.user.id])

  const handleTabChange = (value: string) => {
    setSelectedTab(value)
    const params = new URLSearchParams(searchParams.toString())
    if (value === "participants") {
      params.delete("tab")
    } else {
      params.set("tab", value)
    }
    const queryString = params.toString()
    router.push(queryString ? `?${queryString}` : window.location.pathname)
  }

  const handleParticipantsChange = (updatedParticipants: Participant[]) => {
    setParticipants(updatedParticipants)
  }

  const handleRegistrationRequestsChange = (
    updatedRequests: RegistrationRequest[]
  ) => {
    setRegistrationRequests(updatedRequests)
    // Recalculate pending count
    const pending = updatedRequests.filter(
      (req) => req.status === "pending"
    ).length
    setPendingCount(pending)
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/" },
    { label: eventName, href: `/events/${params.id}` },
    { label: "Participants", href: `/events/${params.id}/participants` },
  ]

  const canViewRegistrations =
    isEventCreator ||
    currentUserRole === "admin" ||
    currentUserRole === "management"

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <Breadcrumbs items={breadcrumbItems} />
      </div>

      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">
              Event Participants
            </h1>
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline" className="font-medium">
                Minimum Buy-In: {formatRunescapeGold(minimumBuyIn)} GP
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Edit My Metadata button - visible to all participants */}
            {currentUserId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMetadataModalOpen(true)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit My Metadata
              </Button>
            )}
          </div>
        </div>

        {/* Prize Pool Breakdown */}
        <PrizePoolBreakdown eventId={params.id as string} />

        {/* Tab Navigation */}
        <Tabs
          value={selectedTab}
          onValueChange={handleTabChange}
          className="w-full"
        >
          <TabsList className="mb-6 grid w-full grid-cols-2">
            <TabsTrigger
              value="participants"
              className="flex items-center gap-2"
            >
              <Edit className="h-4 w-4" />
              Participants
              <Badge variant="secondary" className="ml-1">
                {participants.length}
              </Badge>
            </TabsTrigger>
            {canViewRegistrations && (
              <TabsTrigger
                value="registrations"
                className="flex items-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                Registration Requests
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="ml-1">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="participants" className="mt-0">
            <ParticipantsTab
              eventId={params.id as string}
              participants={participants}
              teams={teams}
              minimumBuyIn={minimumBuyIn}
              currentUserRole={currentUserRole}
              isEventCreator={isEventCreator}
              onParticipantsChange={handleParticipantsChange}
            />
          </TabsContent>

          {canViewRegistrations && (
            <TabsContent value="registrations" className="mt-0">
              <RegistrationsTab
                eventId={params.id as string}
                requests={registrationRequests}
                onRequestsChange={handleRegistrationRequestsChange}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Player Metadata Modal - Self-Editing */}
      {currentUserId && (
        <PlayerMetadataModal
          isOpen={metadataModalOpen}
          onClose={() => setMetadataModalOpen(false)}
          eventId={params.id as string}
          userId={currentUserId}
          userName={currentUserName}
          runescapeName={currentUserRunescapeName}
          isSelfEditing={true}
          onMetadataUpdated={async () => {
            // Refresh participants data to show updated metadata indicators
            try {
              const participantsData = await getEventParticipants(
                params.id as string
              )
              setParticipants(participantsData)
            } catch (error) {
              console.error("Error refreshing participants:", error)
            }
          }}
        />
      )}
    </div>
  )
}
