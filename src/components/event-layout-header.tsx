import { notFound } from "next/navigation"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import { calculateEventPrizePool, isRegistrationOpen, getPendingRegistrationCount, getUserRegistrationStatus, getEventRules } from "@/app/actions/events"
import { getUserClans } from "@/app/actions/clan"
import Link from "next/link"
import { Users, Clock, Trophy, ArrowLeft, Lock } from "lucide-react"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { Badge } from "@/components/ui/badge"
import { JoinEventButton } from "@/components/join-event-button"
import { RegistrationStatus } from "@/components/registration-status"
import { EventHeaderActions } from "@/components/event-header-actions"
import AlertBanner from "@/components/ui/alert-banner"
import { EventRulesSheet } from "@/components/event-rules-sheet"
import { EventTimeDisplay } from "@/components/event-time-display"
import { getEventById } from "@/server/queries/events"

export async function EventLayoutHeader({ eventId }: { eventId: string }) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const data = await getEventById(eventId)
  if (!data) {
    notFound()
  }

  const { event, userRole } = data

  if (!userRole) {
    const registrationStatus = await getUserRegistrationStatus(eventId)
    const regOpenStatus = await isRegistrationOpen(eventId)

    return (
      <Card className="mx-auto mb-8 max-w-2xl">
        <CardHeader>
          <CardTitle>Event Access Restricted</CardTitle>
          <CardDescription>
            You are not a participant in this event: {event.title}
          </CardDescription>
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
    )
  }

  const [
    userClans,
    prizePoolData,
    registrationStatus,
    pendingRegistrationsCount,
    rules,
  ] = await Promise.all([
    getUserClans(),
    calculateEventPrizePool(eventId),
    isRegistrationOpen(eventId),
    getPendingRegistrationCount(eventId),
    getEventRules(eventId),
  ])

  const prizePool = prizePoolData.totalPrizePool
  const isAdminOrManagement = userRole === "admin" || userRole === "management"
  const isAdmin = userRole === "admin"

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
    <>
      <div className="mb-6 flex items-center gap-2">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Events
          </Button>
        </Link>
      </div>

      <Card className="mb-8" role="banner">
        <CardHeader>
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="flex flex-wrap items-center justify-start gap-3">
                <h1 className="text-2xl font-bold">{event.title}</h1>
                <Badge
                  variant={
                    eventStatus === "active"
                      ? "default"
                      : eventStatus === "upcoming"
                        ? "secondary"
                        : "outline-solid"
                  }
                  className={
                    eventStatus === "active" ? "bg-green-500 text-white" : ""
                  }
                >
                  {eventStatus === "active"
                    ? "Active"
                    : eventStatus === "upcoming"
                      ? "Upcoming"
                      : "Completed"}
                </Badge>
                {event.clan && (
                  <span className="text-sm text-muted-foreground">
                    Hosted by{" "}
                    <span className="font-medium">{event.clan.name}</span>
                  </span>
                )}
              </div>
              <div className="mb-2 mt-4 flex flex-col gap-0.5 border-l-2 border-primary/20 pl-3">
                <EventTimeDisplay
                  date={startDate}
                  label="Start"
                  eventTz={event.timezone || "UTC"}
                />
                <EventTimeDisplay
                  date={endDate}
                  label="End"
                  eventTz={event.timezone || "UTC"}
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs">
                  <Trophy className="mr-1 h-4 w-4" />
                  <PrizePoolDisplay prizePool={prizePool} />
                </Badge>
                {event.minimumBuyIn && (
                  <Badge variant="outline" className="text-xs">
                    <Clock className="mr-1 h-3 w-3" />
                    {formatRunescapeGold(event.minimumBuyIn)} GP
                  </Badge>
                )}
                {event.registrationDeadline && (
                  <Badge
                    variant={
                      registrationStatus.isOpen ? "outline-solid" : "secondary"
                    }
                    className="text-xs"
                  >
                    <Users className="mr-1 h-3 w-3" />
                    Reg {registrationStatus.isOpen ? "Open" : "Closed"}
                  </Badge>
                )}
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <EventRulesSheet
                eventId={event.id}
                initialRules={rules}
                isAdmin={isAdmin}
              />
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
          </div>

          {event.locked && (
            <AlertBanner
              message="Registrations are locked for this event."
              icon={<Lock className="float-start mr-4 h-8 w-8" />}
              className="mt-4"
            />
          )}
        </CardHeader>
      </Card>
    </>
  )
}
