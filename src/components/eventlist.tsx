import { CreateEventModal } from "./create-event-modal"
import { type EventData, getEvents } from "@/app/actions/events"
import { EventCard } from "./event-card"
import { EventDisplay } from "./events-display"

export default async function EventList({ userId }: { userId: string }) {
  const allEvents = await getEvents(userId)

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Events</h1>
          <CreateEventModal />
        </div>
        <EventDisplay initialEvents={allEvents} />
      </div>
    </>
  )
}
