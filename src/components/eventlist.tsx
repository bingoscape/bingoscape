import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { CreateEventModal } from "./create-event-modal"
import { getEvents } from "@/app/actions/events"


export default async function EventList({ userId }: { userId: string }) {
  const userEvents = await getEvents(userId)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Your Events</h1>
        <CreateEventModal />
      </div>
      {userEvents.length === 0 ? (
        <p>You don&apos;t have any events yet. Create one to get started!</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userEvents.map((event) => (
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
      )}
    </div>
  )
}
