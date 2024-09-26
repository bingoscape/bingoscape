import { notFound } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateBingoModal } from "@/components/create-bingo-modal"
import BingoGrid from "@/components/bingogrid"
import { updateTile, reorderTiles } from '@/app/actions/bingo'
import { getServerAuthSession } from "@/server/auth"
import { getEventWithBingos } from "@/app/actions/events"
import { UUID } from "crypto"
import { getUserClans } from "@/app/actions/clan"
import AssignEventToClanModal from "@/components/assign-event-to-clan-modal"
import { TeamManagement } from "@/components/team-management"

export default async function EventBingosPage({ params }: { params: { id: UUID } }) {
	const session = await getServerAuthSession()
	if (!session || !session.user) {
		notFound()
	}

	const data = await getEventWithBingos(params.id, session.user.id as UUID)

	if (!data) {
		notFound()
	}

	const { event, bingos, isEventAdmin } = data
	const userClans = await getUserClans()

	return (
		<div className="container mx-auto py-10">
			<div className="flex justify-between items-center mb-6">
				<div>
					<h1 className="text-3xl font-bold">{event.title}</h1>
					{event.clan && (
						<p className="text-sm text-muted-foreground mt-2">
							Assigned to clan: {event.clan.name}
						</p>
					)}
				</div>
				<div className="flex space-x-4">
					{isEventAdmin && !event.clan && (
						<AssignEventToClanModal eventId={event.id} clans={userClans.map(uc => ({ id: uc.clan.id, name: uc.clan.name }))} />
					)}
					{isEventAdmin && <CreateBingoModal eventId={event.id} />}
				</div>
			</div>
			<p className="text-muted-foreground mb-8">{event.description}</p>

			<h2 className="text-2xl font-bold mb-4">Bingos</h2>
			{bingos.length === 0 ? (
				<p>No bingos have been created for this event yet.</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{bingos.map((bingo) => (
						<Card key={bingo.id}>
							<CardHeader>
								<CardTitle>{bingo.title}</CardTitle>
								<CardDescription>
									{bingo.description}
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground mb-4">{bingo.description}</p>
								<BingoGrid
									rows={bingo.rows}
									columns={bingo.columns}
									tiles={bingo.tiles}
									isEventAdmin={isEventAdmin}
								/>
							</CardContent>
							<CardFooter>
								<Button variant="outline">View Bingo</Button>
							</CardFooter>
						</Card>
					))}
				</div>
			)}

			<div className="mt-12">
				<h2 className="text-2xl font-bold mb-4">Teams</h2>
				{isEventAdmin ? (
					<TeamManagement eventId={event.id} />
				) : (
					<p>Only event administrators can manage teams.</p>
				)}
			</div>
		</div>
	)
}
