import { Suspense } from "react"
import { Loader2 } from "lucide-react"
import { unauthorized } from "next/navigation"
import type { UUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import {
  getEventById,
  getEventParticipants,
  getRegistrationRequests,
  getPendingRegistrationCount,
  type RegistrationRequest,
} from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import type { Participant } from "./types"
import { EventParticipantsContent } from "./_content"

async function EventParticipantsData(props: { params: Promise<{ id: UUID }> }) {
  const { id } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) unauthorized()

  const [participants, teams, eventData] = await Promise.all([
    getEventParticipants(id as string),
    getTeamsByEventId(id as string),
    getEventById(id as string),
  ])

  const userParticipant = participants.find((p) => p.id === session.user.id)
  const userRole = userParticipant?.role ?? "participant"
  const isCreator = eventData?.event.creatorId === session.user.id
  const canViewRegistrations =
    isCreator || userRole === "admin" || userRole === "management"

  let registrationRequests: RegistrationRequest[] = []
  let pendingCount = 0

  if (canViewRegistrations) {
    ;[registrationRequests, pendingCount] = await Promise.all([
      getRegistrationRequests(id as string),
      getPendingRegistrationCount(id as string),
    ])
  }

  return (
    <EventParticipantsContent
      eventId={id as string}
      initialParticipants={participants as Participant[]}
      initialTeams={teams.map((t) => ({ id: t.id, name: t.name }))}
      initialRegistrationRequests={registrationRequests}
      initialPendingCount={pendingCount}
      minimumBuyIn={eventData?.event.minimumBuyIn ?? 0}
      eventName={eventData?.event.title ?? ""}
      clanId={eventData?.event.clanId ?? null}
      currentUserId={session.user.id}
      currentUserRunescapeName={userParticipant?.runescapeName ?? null}
      currentUserRole={userRole}
      isEventCreator={isCreator}
      canViewRegistrations={canViewRegistrations}
    />
  )
}

export default function EventParticipantsPage(props: {
  params: Promise<{ id: UUID }>
}) {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <EventParticipantsData params={props.params} />
    </Suspense>
  )
}
