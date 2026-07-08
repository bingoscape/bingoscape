import { notFound } from "next/navigation"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId, getCurrentTeamForUser } from "@/app/actions/team"
import type { UUID } from "crypto"
import { BingoDetailClient } from "./bingo-detail-client"
import type { Bingo } from "@/app/actions/events"

export default async function BingoDetailPage(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}) {
  const { id: eventId, bingoId } = await props.params

  const [eventData, teamsData, currentTeamData, userRoleData] =
    await Promise.all([
      getEventById(eventId),
      getTeamsByEventId(eventId),
      getCurrentTeamForUser(eventId),
      getUserRole(eventId),
    ])

  if (!eventData) {
    notFound()
  }

  const bingo = eventData.event.bingos!.find(
    (b: Bingo) => b.id == bingoId
  )
  if (!bingo) {
    notFound()
  }

  return (
    <BingoDetailClient 
      eventId={eventId}
      bingoId={bingoId}
      eventData={eventData}
      teamsData={teamsData}
      currentTeamData={currentTeamData}
      userRoleData={userRoleData || "participant"}
      bingo={bingo}
    />
  )
}
