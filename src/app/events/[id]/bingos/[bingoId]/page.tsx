import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import BingoGridWrapper from '@/components/bingo-grid-wrapper'
import { getEventById, getUserRole } from '@/app/actions/events'
import { getTeamsByEventId, getCurrentTeamForUser } from '@/app/actions/team'
import { Skeleton } from '@/components/ui/skeleton'
import { type UUID } from 'crypto'
import { Breadcrumbs } from '@/components/breadcrumbs'

export default async function BingoDetailPage({ params }: { params: { id: UUID; bingoId: string } }) {
  const { id: eventId, bingoId } = params
  const data = await getEventById(eventId)
  const teams = await getTeamsByEventId(eventId)
  const currentTeam = await getCurrentTeamForUser(eventId)

  if (!data) {
    notFound()
  }

  const { event } = data
  const bingo = event.bingos!.find(b => b.id == bingoId)!

  const userRole = await getUserRole(eventId)

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Events', href: '/events' },
    { label: data.event.title, href: `/events/${eventId}` },
    { label: bingo.title, href: `/events/${eventId}/bingo/${bingoId}` },
  ]

  return (
    <div className="container mx-auto px-4 py-8">
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="text-3xl font-bold mb-6">{bingo.title}</h1>
      <div className="aspect-square w-full max-w-[80vh] mx-auto">
        <Suspense fallback={<Skeleton className="w-full h-full" />}>
          <BingoGridWrapper
            bingo={bingo}
            userRole={userRole}
            currentTeamId={currentTeam?.id}
            teams={teams}
          />
        </Suspense>
      </div>
    </div>
  )
}
