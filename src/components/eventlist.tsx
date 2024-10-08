import { CreateEventModal } from "./create-event-modal"
import { type EventData, getEvents } from "@/app/actions/events"
import { EventCard } from "./event-card"

export default async function EventList({ userId }: { userId: string }) {
  const allEvents = await getEvents(userId)
  const userEvents = allEvents.filter(x => x.event.creatorId == userId)
  const foreignEvents = allEvents.filter(x => x.event.creatorId != userId)

  const renderEventList = (eventsList: EventData[], noEventMessage: string) => {
    if (eventsList.length === 0) {
      return (<p>{noEventMessage}</p>)
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventsList.map(async (ed) => (<EventCard key={ed.event.id} eventData={ed} isParticipant={true} />))}
      </div >
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Your Events</h1>
          <CreateEventModal />
        </div>
        {renderEventList(userEvents, "You do not have any events yet. Create one to get started!")}
      </div>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Participations</h1>
        </div>
        {renderEventList(foreignEvents, "You do not participate in any events yet. Join one to see them here!")}
      </div>
    </>
  )
}
