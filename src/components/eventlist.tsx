import Link from "next/link"

import { EventDisplay } from "./events-display"
import { Button } from "@/components/ui/button"
import { CreateEventButton } from "./create-event-button"
import { JoinEventForm } from "./join-event-form"
import { JoinEventPopover } from "./join-event-popover"
import { Calendar, FileJson, Trophy } from "lucide-react"
import { type getEvents as getEventsType } from "@/server/queries/events"
import {
  categorizeEvents,
  countNeedsAttention,
  filterEventsByRole,
  type RoleFilter,
} from "@/lib/dashboard-events"
import { cn } from "@/lib/utils"

interface EventListProps {
  userId: string
  initialEvents: Awaited<ReturnType<typeof getEventsType>>
  roleFilter?: RoleFilter
}

const FILTERS: { value: RoleFilter; label: string; href: string }[] = [
  { value: "all", label: "All", href: "/" },
  { value: "admin", label: "I run", href: "/?role=admin" },
  { value: "participant", label: "I play", href: "/?role=participant" },
]

function EmptyDashboard() {
  return (
    <div className="osrs-panel mx-auto max-w-3xl rounded-sm p-6 sm:p-10">
      <div className="mb-6 text-center">
        <div className="osrs-slot mx-auto mb-4 w-fit rounded-sm p-4">
          <Calendar aria-hidden="true" className="h-10 w-10 text-primary" />
        </div>
        <h2 className="osrs-heading text-2xl font-bold">No Events Yet</h2>
        <p className="mt-2 text-muted-foreground">
          Run your own bingo, or hop into one your Clan already set up.
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <section
          aria-labelledby="empty-create"
          className="osrs-slot flex flex-col gap-3 rounded-sm p-4"
        >
          <h3 id="empty-create" className="font-semibold">
            Create an Event
          </h3>
          <p className="text-sm text-muted-foreground">
            Set up Boards and a Prize Pool, then invite your Clan.
          </p>
          <CreateEventButton className="mt-auto w-full" />
        </section>
        <section
          aria-labelledby="empty-join"
          className="osrs-slot flex flex-col gap-3 rounded-sm p-4"
        >
          <h3 id="empty-join" className="font-semibold">
            Got an invite?
          </h3>
          <p className="text-sm text-muted-foreground">
            Paste the invite link or code you were sent.
          </p>
          <div className="mt-auto">
            <JoinEventForm idPrefix="join-empty" />
          </div>
        </section>
      </div>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Looking for ideas?{" "}
        <Link
          href="/templates"
          className="text-primary underline-offset-4 hover:underline"
        >
          Browse Templates
        </Link>{" "}
        or find your{" "}
        <Link
          href="/clans"
          className="text-primary underline-offset-4 hover:underline"
        >
          Clan
        </Link>
        .
      </p>
    </div>
  )
}

export default function EventList({
  initialEvents,
  roleFilter = "all",
}: EventListProps) {
  const allEvents = initialEvents
  const hasEvents = allEvents.length > 0
  const now = new Date()

  const visibleEvents = filterEventsByRole(allEvents, roleFilter)
  const categorized = categorizeEvents(visibleEvents, now)
  const liveCount = categorizeEvents(allEvents, now).active.length
  const needsAttention = countNeedsAttention(allEvents)
  const counts: Record<RoleFilter, number> = {
    all: allEvents.length,
    admin: filterEventsByRole(allEvents, "admin").length,
    participant: filterEventsByRole(allEvents, "participant").length,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="osrs-slot rounded-sm p-2">
            <Trophy aria-hidden="true" className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="osrs-heading text-2xl font-bold tracking-tight">
              Events
            </h1>
            {hasEvents && (
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-success">{liveCount}</span>{" "}
                live
                {needsAttention > 0 && (
                  <>
                    {" · "}
                    <Link
                      href="/?role=admin"
                      className="font-medium text-pending underline-offset-4 hover:underline focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {needsAttention} need attention
                    </Link>
                  </>
                )}
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <CreateEventButton className="w-full sm:w-auto" />
          <JoinEventPopover />
          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden sm:inline-flex"
          >
            <Link href="/templates">
              <FileJson aria-hidden="true" className="mr-1.5 h-4 w-4" />
              Templates
            </Link>
          </Button>
        </div>
      </div>

      {hasEvents && (
        <nav
          aria-label="Filter events"
          className="grid grid-cols-3 gap-2 sm:flex sm:w-fit"
        >
          {FILTERS.map((filter) => {
            const selected = filter.value === roleFilter
            return (
              <Link
                key={filter.value}
                href={filter.href}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-sm px-4 text-sm font-medium focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                  selected
                    ? "osrs-btn"
                    : "osrs-slot text-muted-foreground hover:text-foreground"
                )}
              >
                {filter.label}
                <span className="text-xs opacity-80">{counts[filter.value]}</span>
              </Link>
            )
          })}
        </nav>
      )}

      {!hasEvents ? (
        <EmptyDashboard />
      ) : visibleEvents.length === 0 ? (
        <div className="osrs-panel space-y-4 rounded-sm p-8 text-center">
          <p className="text-muted-foreground">
            {roleFilter === "admin"
              ? "You don't run any Events yet."
              : "You aren't playing in any Events yet."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {roleFilter === "admin" ? (
              <CreateEventButton />
            ) : (
              <JoinEventPopover />
            )}
            <Button asChild variant="outline">
              <Link href="/">Show all Events</Link>
            </Button>
          </div>
        </div>
      ) : (
        <EventDisplay categorized={categorized} now={now} />
      )}
    </div>
  )
}
