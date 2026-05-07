import { notFound, unauthorized, forbidden } from "next/navigation"
import { getServerAuthSession } from "@/server/auth"
import { getEventById } from "@/app/actions/events"
import { getEventStats } from "@/app/actions/stats"
import { getEventItemStatistics } from "@/app/actions/item-statistics"
import { getEventPatternCompletion } from "@/app/actions/event-pattern-completion"
import { EventStatsDisplay } from "@/components/event-stats-display"
import type { UUID } from "crypto"

export default async function EventStatsPage(props: { params: Promise<{ id: UUID }> }) {
  const params = await props.params;
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    unauthorized()
  }

  const data = await getEventById(params.id)
  if (!data) {
    notFound()
  }

  const { event, userRole } = data

  // Check if user has access to this event
  if (!userRole) {
    forbidden()
  }

  const [eventStats, itemStatistics, patternCompletionData] = await Promise.all(
    [
      getEventStats(params.id),
      getEventItemStatistics(params.id),
      getEventPatternCompletion(params.id),
    ]
  )

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">{event.title} - Statistics</h1>
        <p className="text-muted-foreground mt-2">Accumulated points across all bingo boards</p>
      </div>

      <EventStatsDisplay
        eventStats={eventStats}
        eventTitle={event.title}
        userRole={userRole}
        itemStatistics={itemStatistics}
        patternCompletionData={patternCompletionData}
      />
    </div>
  )
}
