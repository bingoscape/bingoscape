import { redirect } from "next/navigation"
import { EventPageFrame } from "@/components/event-page-frame"
import { getEventCapabilities } from "@/server/authz"

/**
 * Admin / management pages of an Event (participants, Board submissions, the
 * admin dashboard, Team management ...). The one gate for the whole group:
 * everybody without the manager capability goes back to the Event page.
 * Each page still checks its own, more specific permission (the server guard
 * stays the authority; a layout is not a security boundary in Next.js).
 * They keep the centred container and the Event header; the workspace page
 * ((workspace)/page.tsx) does not. Pages that every member may open live in
 * (member). Route groups do not change URLs.
 */
export default async function EventManageLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const capabilities = await getEventCapabilities(id)

  if (!capabilities.canViewManagerPages) {
    redirect(`/events/${id}`)
  }

  return <EventPageFrame eventId={id}>{children}</EventPageFrame>
}
