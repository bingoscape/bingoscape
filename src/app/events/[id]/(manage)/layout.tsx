import { EventLayoutHeader } from "@/components/event-layout-header"

/**
 * Admin / management pages of an Event (participants, stats, registrations,
 * status, Board submissions ...). They keep the centred container and the
 * Event header; the workspace page ((workspace)/page.tsx) does not.
 * Route groups do not change URLs.
 */
export default async function EventManageLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return (
    <div className="container mx-auto py-6">
      <EventLayoutHeader eventId={id} />
      {children}
    </div>
  )
}
