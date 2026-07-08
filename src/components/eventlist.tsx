import Link from "next/link"
import { type getEvents as getEventsType } from "@/app/actions/events"
import { EventDisplay } from "./events-display"
import { Button } from "@/components/ui/button"
import { CreateEventButton } from "./create-event-button"
import { Plus, TrendingUp, Users, Trophy } from "lucide-react"

interface EventListProps {
  userId: string
  initialEvents: Awaited<ReturnType<typeof getEventsType>>
}

export default function EventList({ userId, initialEvents }: EventListProps) {
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
            <div className="rounded-xl bg-primary/10 p-2 shadow-[0_0_15px_rgba(0,118,255,0.1)]">
              <Trophy aria-hidden="true" className="h-6 w-6 text-primary" />
            </div>
            <h1 className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-2xl font-bold tracking-tight text-transparent">
              Events Dashboard
            </h1>
          </div>
          <div className="hidden h-6 w-px bg-border sm:block"></div>
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
            <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-card/40 px-3 py-1.5 backdrop-blur-sm transition-colors hover:bg-card/60">
              <TrendingUp aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground">{allEvents.length}</span>
              <span className="text-muted-foreground">Total</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1.5 backdrop-blur-sm transition-colors hover:bg-green-500/20">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {activeEventsCount}
              </span>
              <span className="text-green-600/70 dark:text-green-400/70">
                Active
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 backdrop-blur-sm transition-colors hover:bg-amber-500/20">
              <Trophy aria-hidden="true" className="h-4 w-4 text-amber-500" />
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                {formattedPrizePool}
              </span>
              <span className="text-amber-600/70 dark:text-amber-400/70">
                Prize Pool
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-purple-500/10 px-3 py-1.5 backdrop-blur-sm transition-colors hover:bg-purple-500/20">
              <Users aria-hidden="true" className="h-4 w-4 text-purple-500" />
              <span className="font-semibold text-purple-600 dark:text-purple-400">
                {totalBingos}
              </span>
              <span className="text-purple-600/70 dark:text-purple-400/70">
                Bingos
              </span>
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
