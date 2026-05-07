import { notFound, unauthorized } from "next/navigation"
import type { UUID } from "crypto"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import { getServerAuthSession } from "@/server/auth"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId, getCurrentTeamForUser } from "@/app/actions/team"
import type { Bingo } from "@/app/actions/events"
import { BingoDetailContent } from "./_content"

async function BingoDetailData(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}) {
  const { id: eventId, bingoId } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) unauthorized()

  const [eventData, teams, currentTeam, userRole] = await Promise.all([
    getEventById(eventId),
    getTeamsByEventId(eventId),
    getCurrentTeamForUser(eventId),
    getUserRole(eventId),
  ])

  if (!eventData) notFound()

  const bingo = eventData.event.bingos?.find(
    (b: Bingo) => b.id === bingoId
  )
  if (!bingo) notFound()

  return (
    <BingoDetailContent
      eventId={eventId}
      bingoId={bingoId}
      gameType={eventData.event.gameType}
      bingo={bingo}
      teams={teams}
      currentTeam={currentTeam}
      userRole={userRole ?? "participant"}
    />
  )
}

export default function BingoDetailPage(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="mb-6 h-6 w-full" />
          <Skeleton className="mx-auto aspect-square w-full max-w-[80vh]" />
        </div>
      }
    >
      <BingoDetailData params={props.params} />
    </Suspense>
  )
}
