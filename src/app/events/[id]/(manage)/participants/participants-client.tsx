"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Edit, UserPlus } from "lucide-react"
import { getEventParticipants } from "@/app/actions/events"
import type { RegistrationRequest } from "@/app/actions/events"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { ParticipantsTab } from "@/components/participants-tab"
import { PlayerMetadataModal } from "@/components/player-metadata-modal"
import { PrizePoolBreakdown } from "@/components/prize-pool-breakdown"
import { RegistrationsTab } from "@/components/registrations-tab"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import type { EventCapabilities } from "@/lib/authz/capabilities"
import type { Participant, Team } from "./types"

interface ParticipantsPageClientProps {
  eventId: string
  eventName: string
  minimumBuyIn: number
  clanId: string | null
  capabilities: EventCapabilities
  initialParticipants: Participant[]
  teams: Team[]
  initialRegistrationRequests: RegistrationRequest[]
  initialPendingCount: number
  /** The signed-in participant, for editing their own metadata. */
  currentUser: { id: string; runescapeName: string | null } | null
}

/**
 * The transient state of the participants page: the selected tab (kept in the
 * URL), the table and request lists the tabs edit optimistically, and the
 * self-edit dialog. The data itself comes from the server page.
 */
export function ParticipantsPageClient({
  eventId,
  eventName,
  minimumBuyIn,
  clanId,
  capabilities,
  initialParticipants,
  teams,
  initialRegistrationRequests,
  initialPendingCount,
  currentUser,
}: ParticipantsPageClientProps) {
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants)
  const [registrationRequests, setRegistrationRequests] = useState<
    RegistrationRequest[]
  >(initialRegistrationRequests)
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)

  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedTab, setSelectedTab] = useState<string>(
    searchParams.get("tab") ?? "participants"
  )

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

  const handleRegistrationRequestsChange = (
    updatedRequests: RegistrationRequest[]
  ) => {
    setRegistrationRequests(updatedRequests)
    setPendingCount(
      updatedRequests.filter((req) => req.status === "pending").length
    )
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/" },
    { label: eventName, href: `/events/${eventId}` },
    { label: "Participants", href: `/events/${eventId}/participants` },
  ]

  const canViewRegistrations = capabilities.canReviewRegistrations

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
            {currentUser && (
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
        <PrizePoolBreakdown eventId={eventId} />

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
              eventId={eventId}
              participants={participants}
              teams={teams}
              minimumBuyIn={minimumBuyIn}
              capabilities={capabilities}
              clanId={clanId}
              onParticipantsChange={setParticipants}
            />
          </TabsContent>

          {canViewRegistrations && (
            <TabsContent value="registrations" className="mt-0">
              <RegistrationsTab
                eventId={eventId}
                requests={registrationRequests}
                onRequestsChange={handleRegistrationRequestsChange}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>

      {/* Player Metadata Modal - Self-Editing */}
      {currentUser && (
        <PlayerMetadataModal
          isOpen={metadataModalOpen}
          onClose={() => setMetadataModalOpen(false)}
          eventId={eventId}
          userId={currentUser.id}
          userName={null}
          runescapeName={currentUser.runescapeName}
          isSelfEditing={true}
          onMetadataUpdated={async () => {
            // Refresh participants data to show updated metadata indicators
            try {
              setParticipants(await getEventParticipants(eventId))
            } catch (error) {
              console.error("Error refreshing participants:", error)
            }
          }}
        />
      )}
    </div>
  )
}
