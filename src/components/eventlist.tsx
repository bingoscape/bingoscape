import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateEventModal } from "./create-event-modal"
import { type Event, getEvents } from "@/app/actions/events"


export default async function EventList({ userId }: { userId: string }) {
  const allEvents = await getEvents(userId)
  const userEvents = allEvents.filter(x => x.creatorId == userId)
  const foreignEvents = allEvents.filter(x => x.creatorId != userId)


  const renderEventList = (eventsList: Event[], noEventMessage: string) => {
    if (eventsList.length === 0) {
      return (<p>{noEventMessage}</p>)
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {eventsList.map((event) => (
          <Card key={event.id}>
            <CardHeader>
              <CardTitle>{event.title}</CardTitle>
              <CardDescription>{new Date(event.createdAt).toLocaleDateString()}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">{event.description}</p>
            </CardContent>
            <CardFooter>
              <Link href={`/events/${event.id}`}>
                <Button variant="outline">View Event</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
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
