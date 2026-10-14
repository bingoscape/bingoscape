import { EventPageFrame } from "@/components/event-page-frame"

/**
 * Event pages every member may open (statistics, Board statistics, ship
 * placement, registration status, old Board links). Same container and Event
 * header as the manager pages in (manage); the parent layout already keeps
 * non-members out, and each page checks what it needs. Route groups do not
 * change URLs.
 */
export default async function EventMemberLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  return <EventPageFrame eventId={id}>{children}</EventPageFrame>
}
