import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateBingoModal } from "@/components/create-bingo-modal"
import BingoGrid from "@/components/bingogrid"
import { getServerAuthSession } from "@/server/auth"
import {
    getEventById,
    getTotalBuyInsForEvent,
    isRegistrationOpen,
    getPendingRegistrationCount,
    getUserRegistrationStatus,
} from "@/app/actions/events"
import type { UUID } from "crypto"
import { getUserClans } from "@/app/actions/clan"
import AssignEventToClanModal from "@/components/assign-event-to-clan-modal"
import { TeamManagement } from "@/components/team-management"
import { GenerateEventInviteLink } from "@/components/generate-event-invite-link"
import { TeamDisplay } from "@/components/team-display"
import { DeleteBingoButton } from "@/components/delete-bingo-button"
import { BingoInfoModal } from "@/components/bingo-info-modal"
import Link from "next/link"
import { Users, Clock, ClipboardList, ListFilter } from "lucide-react"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { EditEventModal } from "@/components/edit-event-modal"
import { EditBingoModal } from "@/components/edit-bingo-modal"
import { TeamSelector } from "@/components/team-selector"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { ShareEventButton } from "@/components/share-event-button"
import { Badge } from "@/components/ui/badge"
import { JoinEventButton } from "@/components/join-event-button"
import { RegistrationStatus } from "@/components/registration-status"
import { DiscordWebhookManagement } from "@/components/discord-webhook-management"

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

    // If userRole is null, the user is not a participant
    if (!userRole) {
        // Get registration status to show appropriate UI
        const registrationStatus = await getUserRegistrationStatus(params.id)
        const regOpenStatus = await isRegistrationOpen(params.id)

        return (
            <div className="container mx-auto py-10">
                <Card className="max-w-2xl mx-auto">
                    <CardHeader>
                        <CardTitle>Event Access Restricted</CardTitle>
                        <CardDescription>You are not a participant in this event: {event.title}</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {registrationStatus.status !== "not_requested" ? (
                            <RegistrationStatus
                                eventId={event.id}
                                eventTitle={event.title}
                                status={registrationStatus.status}
                                message={registrationStatus.message}
                                responseMessage={registrationStatus.responseMessage}
                            />
                        ) : (
                            <div className="space-y-4">
                                <p>You need to join this event to view its details.</p>
                                <JoinEventButton
                                    eventId={event.id}
                                    registrationStatus={regOpenStatus}
                                    requiresApproval={event.requiresApproval}
                                />
                            </div>
                        )}
                    </CardContent>
                    <CardFooter className="flex justify-between">
                        <Button variant="outline" asChild>
                            <Link href="/">Return to Home</Link>
                        </Button>
                    </CardFooter>
                </Card>
            </div>
        )
    }

    const userClans = await getUserClans()
    const currentTeam = await getCurrentTeamForUser(params.id)
    const prizePool = await getTotalBuyInsForEvent(params.id)
    const registrationStatus = await isRegistrationOpen(params.id)
    const pendingRegistrationsCount = await getPendingRegistrationCount(params.id)

    const isAdminOrManagement = userRole === "admin" || userRole === "management"

    // Filter bingos based on user role and visibility
    const visibleBingos = event.bingos?.filter((bingo) => isAdminOrManagement || bingo.visible === true) ?? []

    const bingoCount = visibleBingos.length
    const gridClass = bingoCount <= 1 ? "grid-cols-1" : "md:grid-cols-2 lg:grid-cols-2"
    const cardClass = bingoCount <= 1 ? "max-w-3xl" : ""

    return (
        <div className="container mx-auto py-10">
            <div className="flex flex-col lg:flex-row justify-between mb-6 space-y-5 lg:space-y-0">
                <div className="lg:mr-5 flex-grow">
                    <h1 className="text-3xl font-bold">{event.title}</h1>
                    <PrizePoolDisplay prizePool={prizePool} />
                    {event.clan && <p className="text-sm text-muted-foreground mt-2">Clan: {event.clan.name}</p>}
                    {event.minimumBuyIn ? (
                        <p className="text-sm text-muted-foreground mt-2">
                            Minimum BuyIn: {formatRunescapeGold(event.minimumBuyIn)} GP
                        </p>
                    ) : (
                        <p className="text-sm text-muted-foreground mt-2">No Buy-In!</p>
                    )}

                    {/* Registration Deadline Information */}
                    {event.registrationDeadline && (
                        <div className="flex items-center mt-2">
                            <Clock className="h-4 w-4 mr-1 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                                Registration Deadline: {event.registrationDeadline.toDateString()}
                                {!registrationStatus.isOpen && registrationStatus.reason?.includes("deadline") && (
                                    <span className="ml-2 text-destructive font-medium">(Closed)</span>
                                )}
                            </p>
                        </div>
                    )}
                    {event.locked && <p className="text-sm text-destructive mt-2">This event is locked for registration</p>}

                    <div className="flex justify-between items-center mt-6 mb-4">
                        <h2 className="text-2xl font-bold">Bingos</h2>
                        {isAdminOrManagement && event.teams && event.teams.length > 0 && (
                            <TeamSelector teams={event.teams} currentTeamId={currentTeam?.id} userRole={userRole} />
                        )}
                    </div>

                    {visibleBingos.length === 0 ? (
                        <p>No bingos have been created for this event yet.</p>
                    ) : (
                        <div className={`grid ${gridClass} gap-6`}>
                            {visibleBingos.map((bingo) => (
                                <Card key={bingo.id} className={cardClass}>
                                    <CardHeader>
                                        <div className="flex justify-between items-center">
                                            <CardTitle>{bingo.title}</CardTitle>
                                            <div className="flex space-x-2">
                                                <BingoInfoModal bingo={bingo} />
                                                {isAdminOrManagement && (
                                                    <>
                                                        <EditBingoModal bingo={bingo} />
                                                        <DeleteBingoButton bingoId={bingo.id as UUID} />
                                                    </>
                                                )}
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
                                                isLayoutLocked={true}
                                                userRole={userRole}
                                            />
                                        </div>
                                    </CardContent>
                                    <CardFooter className="flex justify-between">
                                        <Link href={`/events/${bingo.eventId}/bingos/${bingo.id}`} passHref>
                                            <Button variant="outline">View Bingo</Button>
                                        </Link>
                                        {isAdminOrManagement && (
                                            <Link href={`/events/${bingo.eventId}/bingos/${bingo.id}/submissions`} passHref>
                                                <Button variant="outline" className="flex items-center gap-2">
                                                    <ListFilter className="h-4 w-4" />
                                                    Submissions
                                                </Button>
                                            </Link>
                                        )}
                                    </CardFooter>
                                </Card>
                            ))}
                        </div>
                    )}

                    <div className="mt-12">
                        <h2 className="text-2xl font-bold mb-4">Teams</h2>
                        {isAdminOrManagement ? <TeamManagement eventId={event.id} /> : <TeamDisplay eventId={event.id} />}
                    </div>
                </div>
                <div className="flex flex-col space-y-4 lg:w-64">
                    {isAdminOrManagement && <CreateBingoModal eventId={event.id} />}
                    {isAdminOrManagement && (
                        <BingoImportExportModal
                            eventId={event.id}
                            bingoId={visibleBingos.length > 0 ? visibleBingos[0]?.id : undefined}
                            bingoTitle={visibleBingos.length > 0 ? visibleBingos[0]?.title : undefined}
                        />
                    )}
                    {isAdminOrManagement && (
                        <GenerateEventInviteLink eventId={event.id as UUID}>Generate Invite Link</GenerateEventInviteLink>
                    )}
                    {(userRole === "admin" || userRole === "management") && (
                        <div className="mt-8">
                            <DiscordWebhookManagement eventId={event.id} />
                        </div>
                    )}
                    {(userRole === "admin" || userRole === "management") && (
                        <Link href={`/events/${params.id}/registrations`} passHref>
                            <Button variant="outline" className="w-full flex items-center">
                                <div className="flex items-center">
                                    <ClipboardList className="mr-2 h-4 w-4" />
                                    <span>Registration Requests</span>
                                </div>
                                {pendingRegistrationsCount > 0 && (
                                    <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                                        {pendingRegistrationsCount}
                                    </Badge>
                                )}
                            </Button>
                        </Link>
                    )}
                    {isAdminOrManagement && (
                        <Link href={`/events/${event.id}/participants`} passHref>
                            <Button variant="outline" className="w-full">
                                <Users className="mr-2 h-4 w-4" />
                                Participants
                            </Button>
                        </Link>
                    )}
                    {userRole == "admin" && !event.clan && (
                        <AssignEventToClanModal
                            eventId={event.id}
                            clans={userClans.map((uc) => ({ id: uc.clan.id, name: uc.clan.name }))}
                        />
                    )}
                    {userRole === "admin" && <EditEventModal event={event} />}
                    {isAdminOrManagement && (
                        <ShareEventButton eventId={event.id} eventTitle={event.title} isPublic={event.public ?? false} />
                    )}
                </div>
            </div>
        </div>
    )
}
