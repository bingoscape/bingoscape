import { Calendar, Clock, Archive, ChevronDown } from "lucide-react"

import { DashboardEventCard } from "@/components/dashboard/dashboard-event-card"
import type { EventData } from "@/app/actions/events"
import type { CategorizedEvents } from "@/lib/dashboard-events"
import type { EventState } from "@/lib/event-time"

interface EventDisplayProps {
  categorized: CategorizedEvents
  now: Date
  /** Optional extra content rendered under each card (e.g. join status). */
  footer?: (eventData: EventData, state: EventState) => React.ReactNode
}

function SectionHeading({
  id,
  icon,
  title,
  count,
}: {
  id: string
  icon: React.ReactNode
  title: string
  count: number
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="osrs-slot hidden rounded-sm p-2 sm:block">{icon}</div>
      <h2 id={id} className="osrs-heading text-xl font-bold tracking-tight">
        {title}{" "}
        <span className="text-base font-normal text-muted-foreground">
          ({count})
        </span>
      </h2>
    </div>
  )
}

function EventGrid({
  labelledBy,
  events,
  state,
  now,
  footer,
}: {
  labelledBy: string
  events: EventData[]
  state: EventState
  now: Date
  footer?: EventDisplayProps["footer"]
}) {
  return (
    <ul
      role="list"
      aria-labelledby={labelledBy}
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3"
    >
      {events.map((ed) => (
        <li key={ed.event.id}>
          <DashboardEventCard eventData={ed} state={state} now={now} />
          {footer?.(ed, state)}
        </li>
      ))}
    </ul>
  )
}

export function EventDisplay({ categorized, now, footer }: EventDisplayProps) {
  const { active, upcoming, past } = categorized

  return (
    <div className="space-y-8">
      {active.length > 0 && (
        <section aria-labelledby="events-live" className="space-y-3">
          <SectionHeading
            id="events-live"
            icon={<Clock className="size-5 text-success" aria-hidden="true" />}
            title="Live Now"
            count={active.length}
          />
          <EventGrid
            labelledBy="events-live"
            events={active}
            state="active"
            now={now}
            footer={footer}
          />
        </section>
      )}

      {upcoming.length > 0 && (
        <section aria-labelledby="events-upcoming" className="space-y-3">
          <SectionHeading
            id="events-upcoming"
            icon={
              <Calendar className="size-5 text-pending" aria-hidden="true" />
            }
            title="On The Horizon"
            count={upcoming.length}
          />
          <EventGrid
            labelledBy="events-upcoming"
            events={upcoming}
            state="upcoming"
            now={now}
            footer={footer}
          />
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="events-archive">
          {/* Native <details>: collapsed by default, no client JS needed. */}
          <details
            className="group/archive"
            open={active.length + upcoming.length === 0}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-sm focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
              <SectionHeading
                id="events-archive"
                icon={
                  <Archive
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                }
                title="The Archive"
                count={past.length}
              />
              <ChevronDown
                aria-hidden="true"
                className="size-5 shrink-0 text-muted-foreground transition-transform group-open/archive:rotate-180"
              />
            </summary>
            <div className="pt-3">
              <EventGrid
                labelledBy="events-archive"
                events={past}
                state="past"
                now={now}
                footer={footer}
              />
            </div>
          </details>
        </section>
      )}
    </div>
  )
}
