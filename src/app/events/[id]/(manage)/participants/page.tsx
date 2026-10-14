import { notFound, redirect } from "next/navigation"
import {
  getEventParticipants,
  getPendingRegistrationCount,
  getRegistrationRequests,
} from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import { getServerAuthSession } from "@/server/auth"
import { getEventCapabilities } from "@/server/authz"
import { getParticipantsEventInfo } from "@/server/queries/participants"
import { ParticipantsPageClient } from "./participants-client"

/**
 * Participants and registration requests of an Event. Everything is fetched
 * here, on the server; the client part only holds the table's transient state.
 * The (manage) layout lets managers in; this page asks for the permission it
 * needs itself.
 */
export default async function EventParticipantsPage(props: {
  params: Promise<{ id: string }>
}) {
  const { id: eventId } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const [event, capabilities] = await Promise.all([
    getParticipantsEventInfo(eventId),
    getEventCapabilities(eventId),
  ])
  if (!event) notFound()

  // Buy-ins and donations are on this page: managers only.
  if (!capabilities.canManageParticipants) redirect(`/events/${eventId}`)

  const [participants, teams, registrationRequests, pendingCount] =
    await Promise.all([
      getEventParticipants(eventId),
      getTeamsByEventId(eventId),
      capabilities.canReviewRegistrations
        ? getRegistrationRequests(eventId)
        : Promise.resolve([]),
      capabilities.canReviewRegistrations
        ? getPendingRegistrationCount(eventId)
        : Promise.resolve(0),
    ])

  // Players edit their own metadata here; the Event creator may have no
  // participant row, and then there is nothing to edit.
  const self = participants.find((p) => p.id === session.user.id)

  return (
    <ParticipantsPageClient
      eventId={eventId}
      eventName={event.title}
      minimumBuyIn={event.minimumBuyIn}
      clanId={event.clanId}
      capabilities={capabilities}
      initialParticipants={participants}
      teams={teams.map((team) => ({ id: team.id, name: team.name }))}
      initialRegistrationRequests={registrationRequests}
      initialPendingCount={pendingCount}
      currentUser={
        self ? { id: self.id, runescapeName: self.runescapeName } : null
      }
    />
  )
}
