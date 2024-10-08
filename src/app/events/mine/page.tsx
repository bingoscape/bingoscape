import { getUserCreatedEvents } from "@/app/actions/events"
import { CreateEventModal } from "@/components/create-event-modal"
import { EventDisplay } from "@/components/events-display"
import { getServerAuthSession } from "@/server/auth"

export default async function MyEventsPage() {
	const session = await getServerAuthSession()
	if (!session) {
		return <div>Please log in to view your events.</div>
	}

	const userEvents = await getUserCreatedEvents()

	return (
		<div className="container mx-auto py-10">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold">Your Events</h1>
				<CreateEventModal />
			</div>
			<EventDisplay initialEvents={userEvents} />
		</div>
	)
}
