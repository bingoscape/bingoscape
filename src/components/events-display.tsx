import { EventData } from "@/app/actions/events"
import { EventCard } from "@/components/event-card"
import { Calendar, Clock, Archive } from "lucide-react"

interface EventDisplayProps {
  initialEvents: EventData[]
}

export function EventDisplay({ initialEvents }: EventDisplayProps) {
  const events = initialEvents

  const categorizeEvents = (events: EventData[]) => {
    const now = new Date()
    return events.reduce(
      (acc, eventData) => {
        const startDate = new Date(eventData.event.startDate)
        const endDate = new Date(eventData.event.endDate)
        if (now >= startDate && now <= endDate) {
          acc.active.push(eventData)
        } else if (now < startDate) {
          acc.upcoming.push(eventData)
        } else {
          acc.past.push(eventData)
        }
        return acc
      },
      { active: [], upcoming: [], past: [] } as {
        active: EventData[]
        upcoming: EventData[]
        past: EventData[]
      }
    )
  }

  const { active, upcoming, past } = categorizeEvents(events)

  if (events.length === 0) {
    return (
      <div className="py-16 text-center">
        <div className="osrs-panel relative mx-auto max-w-2xl overflow-hidden rounded-sm p-8 lg:p-12">
          <div className="mx-auto max-w-md space-y-6">
            <div className="osrs-slot mx-auto w-fit rounded-sm p-4">
              <Calendar aria-hidden="true" className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="osrs-heading text-2xl font-bold">
                No Events Yet
              </h2>
              <p className="text-muted-foreground">
                Get started by creating your first Event. Set up Boards and a
                Prize Pool, and invite your Clan members!
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-16">
      {/* 1. Live Now Section */}
      {active.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="osrs-slot rounded-sm p-2.5">
              <Clock className="h-6 w-6 text-success" aria-hidden="true" />
            </div>
            <h2 className="osrs-heading text-3xl font-bold tracking-tight">
              Live Now
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {active.map((ed) => (
              <EventCard
                key={ed.event.id}
                eventData={ed}
                isParticipant={true}
                status="active"
              />
            ))}
          </div>
        </section>
      )}

      {/* 2. On The Horizon (Upcoming) */}
      {upcoming.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="osrs-slot rounded-sm p-2.5">
              <Calendar className="h-6 w-6 text-pending" aria-hidden="true" />
            </div>
            <h2 className="osrs-heading text-2xl font-bold tracking-tight">
              On The Horizon
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {upcoming.map((ed) => (
              <EventCard
                key={ed.event.id}
                eventData={ed}
                isParticipant={true}
                status="upcoming"
              />
            ))}
          </div>
        </section>
      )}

      {/* 3. The Archive (Past) */}
      {past.length > 0 && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="osrs-slot rounded-sm p-2.5">
              <Archive
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <h2 className="osrs-heading text-2xl font-bold tracking-tight">
              The Archive
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((ed) => (
              <EventCard
                key={ed.event.id}
                eventData={ed}
                isParticipant={true}
                status="past"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
