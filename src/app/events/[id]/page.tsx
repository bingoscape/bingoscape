import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateBingoModal } from "@/components/create-bingo-modal"
import BingoGrid from "@/components/bingogrid"
import { getServerAuthSession } from "@/server/auth"
import { getEventById, getTotalBuyInsForEvent, type Tile } from "@/app/actions/events"
import { type UUID } from "crypto"
import { getUserClans } from "@/app/actions/clan"
import AssignEventToClanModal from "@/components/assign-event-to-clan-modal"
import { TeamManagement } from "@/components/team-management"
import { GenerateEventInviteLink } from "@/components/generate-event-invite-link"
import { TeamDisplay } from "@/components/team-display"
import { DeleteBingoButton } from "@/components/delete-bingo-button"
import { BingoInfoModal } from "@/components/bingo-info-modal"
import Link from "next/link"
import { Users } from "lucide-react"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import { formatRunescapeGold } from '@/lib/utils'
import { EditEventModal } from "@/components/edit-event-modal"

export default async function EventBingosPage({ params }: { params: { id: UUID } }) {
	const session = await getServerAuthSession()
	if (!session || !session.user) {
		notFound()
	}

	const data = await getEventById(params.id)

	if (!data) {
		notFound()
	}

	const { event, userRole } = data
	const userClans = await getUserClans()
	const currentTeam = await getCurrentTeamForUser(params.id)
	const prizePool = await getTotalBuyInsForEvent(params.id)

	const isAdminOrManagement = userRole === 'admin' || userRole === 'management'

	return (
		<div className="container mx-auto py-10">
			<div className="flex justify-between mb-6 space-y-5">
				<div className="mr-5">
					<h1 className="text-3xl font-bold">{event.title}</h1>
					{event.clan && (
						<p className="text-sm text-muted-foreground mt-2">
							Clan: {event.clan.name}
						</p>
					)}
					{event.minimumBuyIn ? (
						<p className="text-sm text-muted-foreground mt-2">
							Minimum BuyIn: {formatRunescapeGold(event.minimumBuyIn)} GP
						</p>
					) : (
						<p className="text-sm text-muted-foreground mt-2">
							No Buy-In!
						</p>
					)}

					<h2 className="text-2xl font-bold mb-4">Bingos</h2>
					{(!!event.bingos && event.bingos.length === 0) ? (
						<p>No bingos have been created for this event yet.</p>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
							{event.bingos!.map((bingo) => (
								<Card key={bingo.id}>
									<CardHeader>
										<div className="flex justify-between items-center">
											<CardTitle>{bingo.title}</CardTitle>
											<div className="flex space-x-2">
												<BingoInfoModal bingo={bingo} />
												{isAdminOrManagement && <DeleteBingoButton bingoId={bingo.id as UUID} />}
											</div>
										</div>
									</CardHeader>
									<CardContent>
										<div className="relative">
											<BingoGrid
												bingo={bingo}
												currentTeamId={currentTeam?.id}
												teams={event.teams ?? []}
												highlightedTiles={[]}
												isLocked={true}
												userRole={userRole}
											/>
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
						{isAdminOrManagement ? (
							<TeamManagement eventId={event.id} />
						) : (
							<TeamDisplay eventId={event.id} />
						)}
					</div>
				</div>
				<div className="flex flex-col space-y-1">
					{isAdminOrManagement && <CreateBingoModal eventId={event.id} />}
					{isAdminOrManagement && <GenerateEventInviteLink eventId={event.id as UUID}>Generate Invite Link</GenerateEventInviteLink>}
					{isAdminOrManagement && (
						<Link href={`/events/${event.id}/participants`} passHref>
							<Button variant="outline" className="w-full">
								<Users className="mr-2 h-4 w-4" />
								Manage Participants
							</Button>
						</Link>
					)}
					{userRole == 'admin' && !event.clan && (
						<AssignEventToClanModal eventId={event.id} clans={userClans.map(uc => ({ id: uc.clan.id, name: uc.clan.name }))} />
					)}
					{userRole === 'admin' && <EditEventModal event={event} />}
					<PrizePoolDisplay prizePool={prizePool} />
				</div>
			</div>
		</div>
	)
}
