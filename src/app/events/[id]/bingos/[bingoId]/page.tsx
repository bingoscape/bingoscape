import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import BingoGrid from '@/components/bingogrid'
import { getBingoById } from '@/app/actions/bingo'
import { getEventById, getUserRole } from '@/app/actions/events'
import { getTeamsByEventId, getCurrentTeamForUser } from '@/app/actions/team'
import { Skeleton } from '@/components/ui/skeleton'
import { type UUID } from 'crypto'

export default async function BingoDetailPage({ params }: { params: { id: UUID; bingoId: string } }) {
	const { id: eventId, bingoId } = params
	const data = await getEventById(eventId)
	const teams = await getTeamsByEventId(eventId)
	const currentTeam = await getCurrentTeamForUser(eventId)

	if (!data) {
		notFound()
	}

	const { bingos } = data
	const bingo = bingos.find(b => b.id == bingoId)!

	const userRole = await getUserRole(eventId)

	return (
		<div className="container mx-auto px-4 py-8">
			<h1 className="text-3xl font-bold mb-6">{bingo.title}</h1>
			<div className="aspect-square w-full max-w-[80vh] mx-auto">
				<Suspense fallback={<Skeleton className="w-full h-full" />}>
					<BingoGrid
						rows={bingo.rows}
						columns={bingo.columns}
						tiles={bingo.tiles}
						userRole={userRole}
						currentTeamId={currentTeam?.id}
						teams={teams}
						codephrase={bingo.codephrase}
					/>
				</Suspense>
			</div>
		</div>
	)
}

