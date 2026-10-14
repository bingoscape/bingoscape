import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getServerAuthSession } from "@/server/auth"
import { getPendingRegistrationCount, getEventRules } from "@/app/actions/events"
import { getUserClans } from "@/app/actions/clan"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { EventHeaderActions } from "@/components/event-header-actions"
import { EventRulesSheet } from "@/components/event-rules-sheet"
import { getEventCapabilities } from "@/server/authz"
import { getEventById } from "@/server/queries/events"

export async function EventLayoutHeader({ eventId }: { eventId: string }) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const [data, capabilities] = await Promise.all([
    getEventById(eventId),
    getEventCapabilities(eventId),
  ])
  if (!data) {
    notFound()
  }

  const { event } = data

  // Access (membership) is handled by EventAccessGuard in the layout

  const [
    userClans,
    pendingRegistrationsCount,
    rules,
  ] = await Promise.all([
    getUserClans(),
    getPendingRegistrationCount(eventId),
    getEventRules(eventId),
  ])

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
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-muted-foreground hover:text-foreground">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-sm">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to Events</span>
          </Button>
        </Link>
        
        <div className="flex items-center gap-3">
          <h1 className="osrs-heading text-2xl font-semibold tracking-tight text-primary">{event.title}</h1>
          <Badge
            variant={
              eventStatus === "active"
                ? "success"
                : eventStatus === "upcoming"
                  ? "info"
                  : "outline"
            }
          >
            {eventStatus === "active"
              ? "Active"
              : eventStatus === "upcoming"
                ? "Upcoming"
                : "Completed"}
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <EventRulesSheet
          eventId={event.id}
          initialRules={rules}
          canManageRules={capabilities.canManageRules}
        />
        {capabilities.canViewManagerPages && (
          <EventHeaderActions
            eventId={event.id}
            capabilities={capabilities}
            requiresApproval={event.requiresApproval}
            pendingRegistrationsCount={pendingRegistrationsCount}
            event={event}
            userClans={userClans}
          />
        )}
      </div>
    </div>
  )
}
