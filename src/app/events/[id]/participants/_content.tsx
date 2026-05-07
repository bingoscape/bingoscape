"use client"

import { useState } from "react"
import { useSearchParams, useRouter, usePathname } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Edit, UserPlus } from "lucide-react"
import { getEventParticipants } from "@/app/actions/events"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { PrizePoolBreakdown } from "@/components/prize-pool-breakdown"
import { PlayerMetadataModal } from "@/components/player-metadata-modal"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ParticipantsTab } from "@/components/participants-tab"
import { RegistrationsTab } from "@/components/registrations-tab"
import type { Participant, Team } from "./types"
import type { RegistrationRequest } from "@/app/actions/events"

interface EventParticipantsContentProps {
  eventId: string
  initialParticipants: Participant[]
  initialTeams: Team[]
  initialRegistrationRequests: RegistrationRequest[]
  initialPendingCount: number
  minimumBuyIn: number
  eventName: string
  clanId: string | null
  currentUserId: string
  currentUserRunescapeName: string | null
  currentUserRole: "admin" | "management" | "participant"
  isEventCreator: boolean
  canViewRegistrations: boolean
}

export function EventParticipantsContent({
  eventId,
  initialParticipants,
  initialTeams,
  initialRegistrationRequests,
  initialPendingCount,
  minimumBuyIn,
  eventName,
  clanId,
  currentUserId,
  currentUserRunescapeName,
  currentUserRole,
  isEventCreator,
  canViewRegistrations,
}: EventParticipantsContentProps) {
  const [participants, setParticipants] =
    useState<Participant[]>(initialParticipants)
  const [registrationRequests, setRegistrationRequests] = useState<
    RegistrationRequest[]
  >(initialRegistrationRequests)
  const [pendingCount, setPendingCount] = useState(initialPendingCount)
  const [metadataModalOpen, setMetadataModalOpen] = useState(false)
  const [currentUserRunescapeNameState, setCurrentUserRunescapeNameState] =
    useState<string | null>(currentUserRunescapeName)

  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const [selectedTab, setSelectedTab] = useState<string>(
    searchParams.get("tab") ?? "participants"
  )

  const handleTabChange = (value: string) => {
    setSelectedTab(value)
    const newParams = new URLSearchParams(searchParams.toString())
    if (value === "participants") {
      newParams.delete("tab")
    } else {
      newParams.set("tab", value)
    }
    const queryString = newParams.toString()
    router.push(queryString ? `?${queryString}` : pathname)
  }

  const handleParticipantsChange = (updatedParticipants: Participant[]) => {
    setParticipants(updatedParticipants)
  }

  const handleRegistrationRequestsChange = (
    updatedRequests: RegistrationRequest[]
  ) => {
    setRegistrationRequests(updatedRequests)
    const pending = updatedRequests.filter(
      (req) => req.status === "pending"
    ).length
    setPendingCount(pending)
  }

  const breadcrumbItems = [
    { label: "Home", href: "/" },
    { label: "Events", href: "/" },
    { label: eventName, href: `/events/${eventId}` },
    { label: "Participants", href: `/events/${eventId}/participants` },
  ]

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
              teams={initialTeams}
              minimumBuyIn={minimumBuyIn}
              currentUserRole={currentUserRole}
              isEventCreator={isEventCreator}
              clanId={clanId}
              onParticipantsChange={handleParticipantsChange}
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

      {currentUserId && (
        <PlayerMetadataModal
          isOpen={metadataModalOpen}
          onClose={() => setMetadataModalOpen(false)}
          eventId={eventId}
          userId={currentUserId}
          userName={null}
          runescapeName={currentUserRunescapeNameState}
          isSelfEditing={true}
          onMetadataUpdated={async () => {
            try {
              const updated = await getEventParticipants(eventId)
              setParticipants(updated as Participant[])
              const me = updated.find((p) => p.id === currentUserId)
              if (me) setCurrentUserRunescapeNameState(me.runescapeName)
            } catch (error) {
              console.error("Error refreshing participants:", error)
            }
          }}
        />
      )}
    </div>
  )
}
