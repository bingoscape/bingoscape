import { notFound } from "next/navigation"
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import {
    getEventById,
    calculateEventPrizePool,
    isRegistrationOpen,
    getPendingRegistrationCount,
    getUserRegistrationStatus,
} from "@/app/actions/events"
import type { UUID } from "crypto"
import { getUserClans } from "@/app/actions/clan"
import { TeamManagement } from "@/components/team-management"
import { TeamDisplay } from "@/components/team-display"
import Link from "next/link"
import { Users, Clock, Calendar, Trophy, ArrowLeft } from "lucide-react"
import { getCurrentTeamForUser } from "@/app/actions/team"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { Badge } from "@/components/ui/badge"
import { JoinEventButton } from "@/components/join-event-button"
import { RegistrationStatus } from "@/components/registration-status"
import { EventBingosClient } from "@/components/event-bingos-client"
import { EventHeaderActions } from "@/components/event-header-actions"

export default async function EventBingosPage(props: { params: Promise<{ id: UUID }> }) {
    const params = await props.params;
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
    const prizePoolData = await calculateEventPrizePool(params.id)
    const prizePool = prizePoolData.totalPrizePool
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

            {/* Compact Event Header with Command Palette */}
            <Card className="mb-8" role="banner">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-2xl font-bold">{event.title}</h1>
                                <Badge
                                    variant={eventStatus === "active" ? "default" : eventStatus === "upcoming" ? "secondary" : "outline"}
                                    className={eventStatus === "active" ? "bg-green-500 text-white" : ""}
                                >
                                    {eventStatus === "active" ? "Active" : eventStatus === "upcoming" ? "Upcoming" : "Completed"}
                                </Badge>
                                {event.clan && (
                                    <span className="text-sm text-muted-foreground">
                                        Hosted by <span className="font-medium">{event.clan.name}</span>
                                    </span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-2 mt-2">
                                <Badge variant="outline" className="text-xs">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                    <Trophy className="h-3 w-3 mr-1" />
                                    <PrizePoolDisplay prizePool={prizePool} />
                                </Badge>
                                {event.minimumBuyIn && (
                                    <Badge variant="outline" className="text-xs">
                                        <Clock className="h-3 w-3 mr-1" />
                                        {formatRunescapeGold(event.minimumBuyIn)} GP
                                    </Badge>
                                )}
                                {event.registrationDeadline && (
                                    <Badge variant={registrationStatus.isOpen ? "outline" : "secondary"} className="text-xs">
                                        <Users className="h-3 w-3 mr-1" />
                                        Reg {registrationStatus.isOpen ? "Open" : "Closed"}
                                    </Badge>
                                )}
                            </div>
                        </div>
                        {isAdminOrManagement && (
                            <EventHeaderActions
                                eventId={event.id}
                                userRole={userRole}
                                requiresApproval={event.requiresApproval}
                                pendingRegistrationsCount={pendingRegistrationsCount}
                                event={event}
                                userClans={userClans}
                            />
                        )}
                    </div>

                    {event.locked && (
                        <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
                            <p className="text-sm text-destructive font-medium">⚠️ This event is locked for registration</p>
                        </div>
                    )}
                </CardHeader>
            </Card>

            {/* Main Content - Full Width */}
            <main className="w-full">
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
        </div>
    )
}
