'use client'

import { notFound, useRouter } from "next/navigation";
import { getClanEvents } from "@/app/actions/clan";
import { joinEvent } from "@/app/actions/events";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { CalendarIcon, UserIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";
import { createArray } from "@/lib/utils";

type Event = {
	id: string;
	title: string;
	description: string | null;
	startDate: Date;
	endDate: Date;
	creatorId: string;
	createdAt: Date;
	updatedAt: Date;
	clanId: string | null;
	creator?: {
		runescapeName: string | null;
	};
	eventParticipants?: {
		userId: string;
	}[];
};

export default function ClanEventsPage({ params }: { params: { clanId: string } }) {
	const [clanEvents, setClanEvents] = useState<Event[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { data: session, status } = useSession();
	const router = useRouter();

	useEffect(() => {
		const fetchData = async () => {
			if (status === 'loading') return;

			if (status === 'unauthenticated') {
				router.push('/login');
				return;
			}

			try {
				const events = await getClanEvents(params.clanId);
				setClanEvents(events);
			} catch (error) {
				if (error instanceof Error && error.message === "You are not a member of this clan") {
					notFound();
				}
				toast({
					title: "Error",
					description: "Failed to load clan events.",
					variant: "destructive",
				});
			} finally {
				setIsLoading(false);
			}
		};

		fetchData().then(() => console.log("done")).catch(err => console.error(err));
	}, [params.clanId, status, router]);

	const handleJoinEvent = async (eventId: string) => {
		if (!session?.user?.id) {
			toast({
				title: "Error",
				description: "You must be logged in to join an event.",
				variant: "destructive",
			});
			return;
		}

		try {
			await joinEvent(eventId);
			setClanEvents(prevEvents =>
				prevEvents.map(event =>
					event.id === eventId
						? {
							...event,
							eventParticipants: [
								...(event.eventParticipants ?? []),
								{ userId: session.user.id }
							]
						}
						: event
				)
			);
			toast({
				title: "Success",
				description: "You have successfully joined the event.",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: error instanceof Error ? error.message : "Failed to join the event.",
				variant: "destructive",
			});
		}
	};

	const isParticipant = (event: Event) => {
		return event.eventParticipants?.some(participant => participant.userId === session?.user?.id);
	};

	if (status === 'loading' || isLoading) {
		return (
			<div className="container mx-auto py-10">
				<Skeleton className="h-10 w-48 mb-6" />
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{createArray(6).map(index => (
						<Card key={index}>
							<CardHeader>
								<Skeleton className="h-6 w-3/4 mb-2" />
								<Skeleton className="h-4 w-1/2" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-16 w-full mb-4" />
								<Skeleton className="h-4 w-1/3" />
							</CardContent>
							<CardFooter className="flex justify-between">
								<Skeleton className="h-9 w-24" />
								<Skeleton className="h-9 w-24" />
							</CardFooter>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (status === 'unauthenticated') {
		return null; // The useEffect will handle the redirect
	}

	return (
		<div className="container mx-auto py-10">
			<h1 className="text-3xl font-bold mb-6">Clan Events</h1>
			{clanEvents.length === 0 ? (
				<p className="text-muted-foreground">No events have been created for this clan yet.</p>
			) : (
				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{clanEvents.map((event) => (
						<Card key={event.id}>
							<CardHeader>
								<CardTitle>{event.title}</CardTitle>
								<CardDescription>
									<div className="flex items-center space-x-2">
										<CalendarIcon className="h-4 w-4" />
										<span>{new Date(event.startDate).toLocaleDateString()} - {new Date(event.endDate).toLocaleDateString()}</span>
									</div>
								</CardDescription>
							</CardHeader>
							<CardContent>
								<p className="text-sm text-muted-foreground mb-4">{event.description}</p>
								<div className="flex items-center space-x-2">
									<UserIcon className="h-4 w-4" />
									<span className="text-sm">Created by: {event.creator?.runescapeName}</span>
								</div>
							</CardContent>
							<CardFooter className="flex justify-between">
								<Link href={`/events/${event.id}`} passHref>
									<Button variant="outline">View Event</Button>
								</Link>
								{!isParticipant(event) && (
									<Button onClick={() => handleJoinEvent(event.id)}>Join Event</Button>
								)}
							</CardFooter>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}
