'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { joinEventViaInvite } from "@/app/actions/events"
import { useSession } from 'next-auth/react'

export default function JoinEventPage({ params }: { params: { inviteCode: string } }) {
	const [isJoining, setIsJoining] = useState(false)
	const router = useRouter()

	const handleJoinEvent = async () => {
		setIsJoining(true)
		try {
			const event = await joinEventViaInvite(params.inviteCode) // Replace 'userId' with actual user ID
			toast({
				title: "Joined event",
				description: `You have successfully joined the event: ${event.title}`,
			})
			router.push(`/events/${event.id}`)
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to join event",
				variant: "destructive",
			})
		} finally {
			setIsJoining(false)
		}
	}

	return (
		<div className="container mx-auto py-10">
			<h1 className="text-3xl font-bold mb-6">Join Event</h1>
			<p className="mb-4">You have been invited to join an event. Click the button below to join.</p>
			<Button onClick={handleJoinEvent} disabled={isJoining}>
				{isJoining ? 'Joining...' : 'Join Event'}
			</Button>
		</div>
	)
}
