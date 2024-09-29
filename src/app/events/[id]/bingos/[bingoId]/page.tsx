import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import BingoGrid from '@/components/bingogrid'
import { getBingoById } from '@/app/actions/bingo'
import { getEventById, getUserRole } from '@/app/actions/events'
import { getTeamsByEventId } from '@/app/actions/team'
import { Skeleton } from '@/components/ui/skeleton'
import { UUID } from 'crypto'

export const dynamic = 'force-dynamic'

export default async function BingoDetailPage({ params }: { params: { id: UUID; bingoId: string } }) {
	const { id: eventId, bingoId } = params
	const bingo = await getBingoById(bingoId)
	const event = await getEventById(eventId)
	const teams = await getTeamsByEventId(eventId)

	if (!bingo || !event) {
		notFound()
	}

	const userRole = await getUserRole(eventId)
	const isEventAdmin = userRole === 'admin' || userRole === 'management'

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">{bingo.title}</h1>
			<div className="aspect-square w-full max-w-[90vh] mx-auto">
				<Suspense fallback={<Skeleton className="w-full h-full" />}>
					<BingoGrid
						rows={bingo.rows}
						columns={bingo.columns}
						tiles={bingo.tiles}
						isEventAdmin={isEventAdmin}
						userRole={userRole}
						teams={teams}
					/>
				</Suspense>
			</div>
		</div>
	)
}

