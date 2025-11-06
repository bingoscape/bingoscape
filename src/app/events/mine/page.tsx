"use client"

import { useState, useEffect } from "react"
import { getUserCreatedEvents } from "@/app/actions/events"
import { CreateEventModal } from "@/components/create-event-modal"
import { EventDisplay } from "@/components/events-display"
import { Button } from "@/components/ui/button"
import { Plus } from "lucide-react"

export default function MyEventsPage() {
	const [createModalOpen, setCreateModalOpen] = useState(false)
	const [userEvents, setUserEvents] = useState<Awaited<ReturnType<typeof getUserCreatedEvents>>>([])
	const [loading, setLoading] = useState(true)

	useEffect(() => {
		async function fetchEvents() {
			const events = await getUserCreatedEvents()
			setUserEvents(events)
			setLoading(false)
		}
		void fetchEvents()
	}, [])

	if (loading) {
		return <div className="container mx-auto py-10">Loading...</div>
	}

	return (
		<div className="container mx-auto py-10">
			<div className="flex justify-between items-center mb-6">
				<h1 className="text-3xl font-bold">Your Events</h1>
				<Button onClick={() => setCreateModalOpen(true)}>
					<Plus className="mr-2 h-4 w-4" />
					Create Event
				</Button>
			</div>
			<EventDisplay initialEvents={userEvents} />
			<CreateEventModal
				isOpen={createModalOpen}
				onClose={() => setCreateModalOpen(false)}
			/>
		</div>
	)
}
