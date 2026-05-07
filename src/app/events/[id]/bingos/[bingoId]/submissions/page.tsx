import { notFound, unauthorized } from "next/navigation"
import { Suspense } from "react"
import { Skeleton } from "@/components/ui/skeleton"
import type { UUID } from "crypto"
import { getServerAuthSession } from "@/server/auth"
import { getEventById, getUserRole } from "@/app/actions/events"
import { getTeamsByEventId } from "@/app/actions/team"
import { getBingoById } from "@/app/actions/getBingoById"
import { BingoSubmissionsContent } from "./_content"

async function BingoSubmissionsData(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}) {
  const { id: eventId, bingoId } = await props.params

  const session = await getServerAuthSession()
  if (!session?.user) unauthorized()

  const [eventData, teams, userRole, bingo] = await Promise.all([
    getEventById(eventId),
    getTeamsByEventId(eventId),
    getUserRole(eventId),
    getBingoById(bingoId),
  ])

  if (!eventData || !bingo) notFound()

  return (
    <BingoSubmissionsContent
      eventId={eventId}
      bingoId={bingoId}
      initialBingo={bingo}
      initialTeams={teams.map((t) => ({ id: t.id, name: t.name }))}
      userRole={userRole}
    />
  )
}

export default function BingoSubmissionsPage(props: {
  params: Promise<{ id: UUID; bingoId: string }>
}) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto px-4 py-8">
          <Skeleton className="mb-4 h-8 w-64" />
          <Skeleton className="mb-6 h-6 w-full" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array(6)
              .fill(0)
              .map((_, i) => (
                <Skeleton key={i} className="h-64 w-full" />
              ))}
          </div>
        </div>
      }
    >
      <BingoSubmissionsData params={props.params} />
    </Suspense>
  )
}
