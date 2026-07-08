import { getUserCreatedEvents } from "@/app/actions/events"
import { EventDisplay } from "@/components/events-display"
import { MyEventsClient } from "./my-events-client"

export default async function MyEventsPage() {
  const userEvents = await getUserCreatedEvents()

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-3xl font-bold">Your Events</h1>
        <MyEventsClient />
      </div>
      <EventDisplay initialEvents={userEvents} />
    </div>
  )
}
