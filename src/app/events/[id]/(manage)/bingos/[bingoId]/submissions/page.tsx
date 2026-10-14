import { notFound, redirect } from "next/navigation"
import { getAllSubmissionsForTeam } from "@/app/actions/bingo"
import { getBingoById } from "@/app/actions/getBingoById"
import { getTeamsByEventId } from "@/app/actions/team"
import { getServerAuthSession } from "@/server/auth"
import { getEventCapabilities } from "@/server/authz"
import { getEventById } from "@/server/queries/events"
import type { TeamTileSubmission } from "@/types/model"
import { BingoSubmissionsClient } from "./submissions-client"

/**
 * Review the Submissions of one Board, for every Team. Fetched on the server;
 * the client part holds the image viewer and the review actions. The (manage)
 * layout lets managers in; this page asks for the permission it needs itself.
 */
export default async function BingoSubmissionsPage(props: {
  params: Promise<{ id: string; bingoId: string }>
}) {
  const { id: eventId, bingoId } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) notFound()

  const [data, capabilities] = await Promise.all([
    getEventById(eventId),
    getEventCapabilities(eventId),
  ])
  if (!data) notFound()
  if (!capabilities.canReviewSubmissions) redirect(`/events/${eventId}`)

  // The Board must exist, be readable and belong to this Event.
  const bingo = await getBingoById(bingoId)
  if (!bingo || bingo.eventId !== eventId) redirect(`/events/${eventId}`)

  const teams = await getTeamsByEventId(eventId)
  const perTeam = await Promise.all(
    teams.map((team) => getAllSubmissionsForTeam(bingoId, team.id))
  )
  const submissions: TeamTileSubmission[] = perTeam.flatMap((byTile) =>
    Object.values(byTile).flatMap((list) => (Array.isArray(list) ? list : []))
  )

  return (
    <BingoSubmissionsClient
      eventId={eventId}
      bingoTitle={bingo.title}
      teams={teams}
      teamTileSubmissions={submissions}
    />
  )
}
