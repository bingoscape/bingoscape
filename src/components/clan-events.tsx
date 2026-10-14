import Link from "next/link"
import { Calendar } from "lucide-react"

import { EventDisplay } from "@/components/events-display"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { categorizeEvents } from "@/lib/dashboard-events"
import { getNow } from "@/lib/now"
import type { ClanEventRow } from "@/server/queries/clans"

interface ClanEventsPanelProps {
  rows: ClanEventRow[]
  clanName: string
}

/**
 * The clan's events grouped like the dashboard (live / upcoming / archive),
 * reusing the dashboard cards. Events the viewer hasn't joined say so under
 * the card, so the stretched card link doesn't promise access it can't give.
 */
export default function ClanEventsPanel({ rows, clanName }: ClanEventsPanelProps) {
  if (rows.length === 0) {
    return (
      <div className="osrs-panel mx-auto max-w-2xl rounded-sm p-6 text-center sm:p-10">
        <div className="osrs-slot mx-auto mb-4 w-fit rounded-sm p-4">
          <Calendar aria-hidden="true" className="size-10 text-primary" />
        </div>
        <h2 className="osrs-heading text-2xl font-bold">No Events Yet</h2>
        <p className="mt-2 text-muted-foreground">
          Events assigned to {clanName} show up here. Create an event, then
          assign it to this clan from the event&apos;s header.
        </p>
        <Button asChild className="mt-5">
          <Link href="/">Go to your events</Link>
        </Button>
      </div>
    )
  }

  const registrationById = new Map(
    rows.map((r) => [r.eventData.event.id, r.registration])
  )
  const categorized = categorizeEvents(rows.map((r) => r.eventData))

  return (
    <EventDisplay
      categorized={categorized}
      now={getNow()}
      footer={(eventData, state) => {
        if (state === "past") return null
        const registration = registrationById.get(eventData.event.id)
        if (registration === "pending") {
          return (
            <p className="mt-1.5">
              <Badge variant="pending">Join request pending</Badge>
            </p>
          )
        }
        if (registration === "none") {
          return (
            <p className="mt-1.5 text-sm text-muted-foreground">
              You haven&apos;t joined this event yet.
            </p>
          )
        }
        return null
      }}
    />
  )
}
