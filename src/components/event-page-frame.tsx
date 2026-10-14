import { EventLayoutHeader } from "@/components/event-layout-header"

/**
 * The centred container and the Event header around the Event pages that are
 * not the full-bleed workspace. Shared by the `(manage)` and `(member)` route
 * groups, which differ only in who may enter.
 */
export function EventPageFrame({
  eventId,
  children,
}: {
  eventId: string
  children: React.ReactNode
}) {
  return (
    <div className="container mx-auto py-6">
      <EventLayoutHeader eventId={eventId} />
      {children}
    </div>
  )
}
