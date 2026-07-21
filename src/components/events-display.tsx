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
        <div className="relative mx-auto max-w-2xl overflow-hidden rounded-2xl border border-border/50 bg-card/40 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.12)] backdrop-blur-xl lg:p-12">
          <div className="mx-auto max-w-md space-y-6">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 shadow-[0_0_15px_rgba(0,118,255,0.2)]">
              <Calendar className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="bg-linear-to-br from-foreground via-foreground/90 to-muted-foreground bg-clip-text text-2xl font-bold text-transparent">
                No Events Yet
              </h2>
              <p className="text-muted-foreground">
                Get started by creating your first bingo event. Organize
                competitions, set up prizes, and invite your clan members!
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
            <div className="rounded-xl bg-green-500/10 p-2.5 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
              <Clock className="h-6 w-6 text-green-500" aria-hidden="true" />
            </div>
            <h2 className="bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-3xl font-bold tracking-tight text-transparent">
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
            <div className="rounded-xl bg-blue-500/10 p-2.5 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Calendar className="h-6 w-6 text-blue-500" aria-hidden="true" />
            </div>
            <h2 className="bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-2xl font-bold tracking-tight text-transparent">
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
            <div className="rounded-xl border border-border/50 bg-muted p-2.5">
              <Archive
                className="h-6 w-6 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <h2 className="bg-linear-to-br from-foreground to-muted-foreground bg-clip-text text-2xl font-bold tracking-tight text-transparent">
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
