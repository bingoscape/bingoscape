import { EventAccessGuard } from "@/components/event-access-guard"
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
  const data = await getEventById(id)

  if (!data?.userRole) {
    return (
      <div className="container mx-auto py-6">
        <EventAccessGuard eventId={id} />
      </div>
    )
  }

  return <>{children}</>
}
