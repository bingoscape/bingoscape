import { notFound } from "next/navigation"
import { EventAccessGuard } from "@/components/event-access-guard"
import { getEventCapabilities } from "@/server/authz"
import { getEventById } from "@/server/queries/events"

/**
 * Access gate for everything under /events/[id]. Members get their page
 * ((workspace) = full-bleed workspace, (manage) = container + Event header);
 * everybody else sees the join / registration flow.
 */
export default async function EventLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [data, capabilities] = await Promise.all([
    getEventById(id),
    // Cached per request: the (manage) gate, the header and the pages reuse it.
    getEventCapabilities(id),
  ])

  // No Event, or one the read policy hides from this viewer (decision 3,
  // `members-only`): indistinguishable from an Event that does not exist.
  if (!data) notFound()

  if (!capabilities.role) {
    return (
      <div className="container mx-auto py-6">
        <EventAccessGuard eventId={id} />
      </div>
    )
  }

  return <>{children}</>
}
