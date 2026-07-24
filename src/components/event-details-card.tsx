import { Badge } from "@/components/ui/badge"
import { Trophy, Coins, Users, Lock } from "lucide-react"
import { PrizePoolDisplay } from "@/components/prize-pool-display"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { EventTimeDisplay } from "@/components/event-time-display"
import AlertBanner from "@/components/ui/alert-banner"
import { getEventById } from "@/server/queries/events"
import { calculateEventPrizePool, isRegistrationOpen } from "@/app/actions/events"

export async function EventDetailsCard({ eventId }: { eventId: string }) {
  const data = await getEventById(eventId)
  if (!data) return null

  const { event } = data

  const [prizePoolData, registrationStatus] = await Promise.all([
    calculateEventPrizePool(eventId),
    isRegistrationOpen(eventId),
  ])

  const prizePool = prizePoolData.totalPrizePool
  const startDate = new Date(event.startDate)
  const endDate = new Date(event.endDate)

  return (
    <div className="mb-8" role="region" aria-label="Event Details">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border bg-muted/30 px-4 py-3 text-sm">
        {/* Time Info */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <EventTimeDisplay
            date={startDate}
            label="Start"
            eventTz={event.timezone || "UTC"}
            className="mb-0"
          />
          <EventTimeDisplay
            date={endDate}
            label="End"
            eventTz={event.timezone || "UTC"}
            className="mb-0"
          />
        </div>

        {/* Divider */}
        <div className="hidden h-5 w-px bg-border sm:block" />

        {/* Stats & Status */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 font-medium">
            <Trophy className="h-4 w-4 text-primary" />
            <PrizePoolDisplay prizePool={prizePool} />
          </div>
          
          {event.minimumBuyIn && (
            <div className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Coins className="h-4 w-4" />
              {formatRunescapeGold(event.minimumBuyIn)} GP
            </div>
          )}
          
          {event.registrationDeadline && (
            <Badge
              variant={registrationStatus.isOpen ? "outline" : "secondary"}
              className="px-2 py-0.5 text-xs bg-background"
            >
              <Users className="mr-1.5 h-3.5 w-3.5" />
              Reg {registrationStatus.isOpen ? "Open" : "Closed"}
            </Badge>
          )}
        </div>
      </div>

      {event.locked && (
        <AlertBanner
          message="Registrations are locked for this event."
          icon={<Lock className="mr-3 h-5 w-5" />}
          className="mt-4"
        />
      )}
    </div>
  )
}
