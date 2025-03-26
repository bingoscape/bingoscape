import { CreateEventModal } from "./create-event-modal"
import { getEvents } from "@/app/actions/events"
import { EventDisplay } from "./events-display"

export default async function EventList({ userId }: { userId: string }) {
  const allEvents = await getEvents(userId)

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Your Events</h1>
          <p className="text-muted-foreground mt-1">Manage and track your RuneScape bingo events</p>
        </div>
        <CreateEventModal />
      </div>

      <EventDisplay initialEvents={allEvents} />
    </div>
  )
}

