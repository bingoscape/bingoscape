import Link from "next/link"

import { EventDisplay } from "./events-display"
import { Button } from "@/components/ui/button"
import { CreateEventButton } from "./create-event-button"
import { TrendingUp, Users, Trophy } from "lucide-react"
import { type getEvents as getEventsType } from "@/server/queries/events"

interface EventListProps {
  userId: string
  initialEvents: Awaited<ReturnType<typeof getEventsType>>
}

export default function EventList({ initialEvents }: EventListProps) {
  const allEvents = initialEvents

  const hasEvents = allEvents.length > 0

  // Calculate active events count
  const activeEventsCount = allEvents.filter((e) => {
    const now = new Date()
    const start = new Date(e.event.startDate)
    const end = new Date(e.event.endDate)
    return now >= start && now <= end
  }).length

  // Calculate prize pool
  const totalPrizePool = allEvents.reduce(
    (sum, event) => sum + event.totalPrizePool,
    0
  )
  const formattedPrizePool = new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(totalPrizePool)

  // Calculate total bingos
  const totalBingos = allEvents.reduce(
    (sum, event) => sum + (event.event.bingos?.length ?? 0),
    0
  )

  return (
    <div className="space-y-8">
      {/* Concise Header Bar */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: Title & Actions */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="osrs-slot rounded-sm p-2">
              <Trophy aria-hidden="true" className="h-6 w-6 text-primary" />
            </div>
            <h1 className="osrs-heading text-2xl font-bold tracking-tight">
              Events Dashboard
            </h1>
          </div>
          <div className="hidden h-6 w-0.5 bg-border sm:block"></div>
          <div className="flex flex-wrap gap-2">
            <CreateEventButton />
            <Button variant="outline" size="sm" asChild>
              <Link href="/templates">
                <Users aria-hidden="true" className="mr-1.5 h-4 w-4" />
                Templates
              </Link>
            </Button>
          </div>
        </div>

        {/* Right: Micro-Stats */}
        {hasEvents && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="osrs-slot flex items-center gap-1.5 rounded-sm px-3 py-1.5">
              <TrendingUp aria-hidden="true" className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">
                {allEvents.length}
              </span>
              <span className="text-muted-foreground">Total</span>
            </div>
            <div className="osrs-slot flex items-center gap-1.5 rounded-sm px-3 py-1.5">
              <div
                aria-hidden="true"
                className="h-2 w-2 animate-pulse rounded-full bg-success"
              ></div>
              <span className="font-semibold text-success">
                {activeEventsCount}
              </span>
              <span className="text-muted-foreground">Active</span>
            </div>
            <div className="osrs-slot flex items-center gap-1.5 rounded-sm px-3 py-1.5">
              <Trophy aria-hidden="true" className="h-4 w-4 text-primary" />
              <span className="osrs-qty">{formattedPrizePool}</span>
              <span className="text-muted-foreground">Prize Pool</span>
            </div>
            <div className="osrs-slot flex items-center gap-1.5 rounded-sm px-3 py-1.5">
              <Users aria-hidden="true" className="h-4 w-4 text-info" />
              <span className="font-semibold text-info">{totalBingos}</span>
              <span className="text-muted-foreground">Boards</span>
            </div>
          </div>
        )}
      </div>

      {/* Events Display */}
      <div className={hasEvents ? "" : "mx-auto max-w-6xl"}>
        <EventDisplay initialEvents={allEvents} />
      </div>
    </div>
  )
}
