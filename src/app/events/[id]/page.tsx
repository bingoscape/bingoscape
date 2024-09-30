import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateBingoModal } from "@/components/create-bingo-modal"
import BingoGrid from "@/components/bingogrid"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/app/actions/events"
import { type UUID } from "crypto"
import { getUserClans } from "@/app/actions/clan"
import AssignEventToClanModal from "@/components/assign-event-to-clan-modal"
import { TeamManagement } from "@/components/team-management"
import { GenerateEventInviteLink } from "@/components/generate-event-invite-link"
import { TeamDisplay } from "@/components/team-display"
import { DeleteBingoButton } from "@/components/delete-bingo-button"
import Link from "next/link"
import { Users, EyeOff } from "lucide-react"

export default async function EventBingosPage({ params }: { params: { id: UUID } }) {
	const session = await getServerAuthSession()
	if (!session || !session.user) {
		notFound()
	}

	const data = await getEventById(params.id)

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
							Clan: {event.clan.name}
						</p>
					)}
				</div>
				<div className="flex space-x-4">
					{isEventAdmin && !event.clan && (
						<AssignEventToClanModal eventId={event.id} clans={userClans.map(uc => ({ id: uc.clan.id, name: uc.clan.name }))} />
					)}
					{isEventAdmin && <CreateBingoModal eventId={event.id} />}
					{isEventAdmin && <GenerateEventInviteLink eventId={event.id as UUID} />}
					{isEventAdmin && (
						<Link href={`/events/${event.id}/participants`} passHref>
							<Button variant="outline">
								<Users className="mr-2 h-4 w-4" />
								Manage Participants
							</Button>
						</Link>
					)}
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
								<div className="flex justify-between items-center">
									<CardTitle>{bingo.title}</CardTitle>
									{isEventAdmin && <DeleteBingoButton bingoId={bingo.id as UUID} />}
								</div>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground mb-4">{bingo.description}</p>
								<div className="relative">
									{bingo.visible && (
										<BingoGrid
											rows={bingo.rows}
											columns={bingo.columns}
											tiles={bingo.tiles}
											teams={event.teams}
											userRole="admin"
											isEventAdmin={isEventAdmin}
										/>
									)}
									{!bingo.visible && (
										<div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
											<EyeOff className="w-16 h-16 text-muted-foreground" />
											<span className="sr-only">This bingo is currently hidden</span>
										</div>
									)}
								</div>
							</CardContent>
							<CardFooter>
								<Link href={`/events/${bingo.eventId}/bingos/${bingo.id}`} passHref>
									<Button variant="outline">View Bingo</Button>
								</Link>
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
					<TeamDisplay eventId={event.id} />
				)}
			</div>
		</div>
	)
}
