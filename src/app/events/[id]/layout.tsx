import { EventLayoutHeader } from "@/components/event-layout-header"
import { getEventById } from "@/server/queries/events"

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
        <EventLayoutHeader eventId={id} />
      </div>
    )
  }

  return (
    <div className="container mx-auto py-6">
      <EventLayoutHeader eventId={id} />
      {children}
    </div>
  )
}
