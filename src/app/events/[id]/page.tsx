import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CreateBingoModal } from "@/components/create-bingo-modal"
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
import Link from "next/link"
import { Users, Clock, ClipboardList, BarChart3, Calendar, Trophy, ArrowLeft } from "lucide-react"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { EditEventModal } from "@/components/edit-event-modal"
import { BingoImportExportModal } from "@/components/bingo-import-export-modal"
import { ShareEventButton } from "@/components/share-event-button"
import { Badge } from "@/components/ui/badge"
import { JoinEventButton } from "@/components/join-event-button"
import { RegistrationStatus } from "@/components/registration-status"
import { DiscordWebhookManagement } from "@/components/discord-webhook-management"
import { EventBingosClient } from "@/components/event-bingos-client"

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

    // Calculate event status
    const now = new Date()
    const startDate = new Date(event.startDate)
    const endDate = new Date(event.endDate)
    let eventStatus: "upcoming" | "active" | "completed" = "upcoming"

    if (now > endDate) {
        eventStatus = "completed"
    } else if (now >= startDate) {
        eventStatus = "active"
    }

    return (
        <div className="container mx-auto py-6">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 mb-6">
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                    <Button variant="ghost" size="sm">
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Back to Events
                    </Button>
                </Link>
            </div>

            {/* Enhanced Event Header */}
            <Card className="mb-8" role="banner">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                                <h1 className="text-3xl font-bold">{event.title}</h1>
                                <Badge
                                    variant={eventStatus === "active" ? "default" : eventStatus === "upcoming" ? "secondary" : "outline"}
                                    className={eventStatus === "active" ? "bg-green-500 text-white" : ""}
                                    aria-label={`Event status: ${eventStatus === "active" ? "Active" : eventStatus === "upcoming" ? "Upcoming" : "Completed"}`}
                                >
                                    {eventStatus === "active" ? "Active" : eventStatus === "upcoming" ? "Upcoming" : "Completed"}
                                </Badge>
                            </div>
                            {event.clan && (
                                <p className="text-muted-foreground">
                                    Hosted by <span className="font-medium">{event.clan.name}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {/* Event Dates */}
                        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                                <Calendar className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Event Period</p>
                                <p className="text-sm text-muted-foreground">
                                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                                </p>
                            </div>
                        </div>

                        {/* Prize Pool */}
                        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center">
                                <Trophy className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Prize Pool</p>
                                <PrizePoolDisplay prizePool={prizePool} />
                            </div>
                        </div>

                        {/* Buy-In */}
                        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                            <div className="flex-shrink-0 w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center">
                                <Clock className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                                <p className="text-sm font-medium">Buy-In</p>
                                <p className="text-sm text-muted-foreground">
                                    {event.minimumBuyIn ?
                                        `${formatRunescapeGold(event.minimumBuyIn)} GP` :
                                        "No Buy-In!"
                                    }
                                </p>
                            </div>
                        </div>

                        {/* Registration Status */}
                        {event.registrationDeadline && (
                            <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
                                <div className="flex-shrink-0 w-8 h-8 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                    <Users className="h-4 w-4 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium">Registration</p>
                                    <p className="text-sm text-muted-foreground">
                                        Until {event.registrationDeadline.toLocaleDateString()}
                                        {!registrationStatus.isOpen && registrationStatus.reason?.includes("deadline") && (
                                            <span className="ml-2 text-destructive font-medium">(Closed)</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {event.locked && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                            <p className="text-sm text-destructive font-medium">⚠️ This event is locked for registration</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            <div className="flex flex-col xl:flex-row justify-between gap-8">
                <main className="flex-grow min-w-0">

                    {/* Client-side bingo display with team selection */}
                    <section aria-label="Event boards">
                        <EventBingosClient
                            event={event}
                            userRole={userRole}
                            currentTeam={currentTeam}
                            isAdminOrManagement={isAdminOrManagement}
                        />
                    </section>

                    <section className="mt-12" aria-label="Team management">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-2xl font-bold">Teams</h2>
                                <p className="text-muted-foreground text-sm mt-1">
                                    Manage team assignments and member roles
                                </p>
                            </div>
                        </div>
                        {isAdminOrManagement ? <TeamManagement eventId={event.id} /> : <TeamDisplay eventId={event.id} />}
                    </section>
                </main>

                {/* Organized Action Sidebar */}
                <aside className="xl:w-80 xl:flex-shrink-0" aria-label="Event actions">
                    <Card className="border-2">
                        <CardHeader className="pb-4">
                            <CardTitle className="text-lg font-semibold">Event Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            {/* Primary Actions */}
                            {isAdminOrManagement && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">BINGO MANAGEMENT</h4>
                                    <div className="space-y-2">
                                        <CreateBingoModal eventId={event.id} />
                                        <BingoImportExportModal
                                            eventId={event.id}
                                            bingoId={(event.bingos?.length ?? 0) > 0 ? event.bingos![0]?.id : undefined}
                                            bingoTitle={(event.bingos?.length ?? 0) > 0 ? event.bingos![0]?.title : undefined}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Event Management */}
                            {isAdminOrManagement && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">EVENT MANAGEMENT</h4>
                                    <div className="space-y-2">
                                        <Link href={`/events/${params.id}/registrations`} passHref>
                                            <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                                                <ClipboardList className="mr-2 h-4 w-4" />
                                                Registration Requests
                                                {pendingRegistrationsCount > 0 && (
                                                    <Badge variant="secondary" className="ml-auto bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200">
                                                        {pendingRegistrationsCount}
                                                    </Badge>
                                                )}
                                            </Button>
                                        </Link>
                                        <Link href={`/events/${event.id}/participants`} passHref>
                                            <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                                                <Users className="mr-2 h-4 w-4" />
                                                Participants
                                            </Button>
                                        </Link>
                                        <Link href={`/events/${event.id}/stats`} passHref>
                                            <Button variant="outline" className="w-full justify-start hover:bg-primary/10">
                                                <BarChart3 className="mr-2 h-4 w-4" />
                                                Event Statistics
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            )}

                            {/* Sharing & Communication */}
                            {isAdminOrManagement && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">SHARING & COMMUNICATION</h4>
                                    <div className="space-y-2">
                                        <GenerateEventInviteLink eventId={event.id as UUID}>
                                            Generate Invite Link
                                        </GenerateEventInviteLink>
                                        <DiscordWebhookManagement eventId={event.id} />
                                        <ShareEventButton
                                            eventId={event.id}
                                            eventTitle={event.title}
                                            isPublic={event.public ?? false}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Admin Settings */}
                            {userRole === "admin" && (
                                <div className="space-y-3">
                                    <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">ADMIN SETTINGS</h4>
                                    <div className="space-y-2">
                                        <EditEventModal event={event} />
                                        {!event.clan && (
                                            <AssignEventToClanModal
                                                eventId={event.id}
                                                clans={userClans.map((uc) => ({ id: uc.clan.id, name: uc.clan.name }))}
                                            />
                                        )}
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </aside>
            </div>
        </div>
    )
}
