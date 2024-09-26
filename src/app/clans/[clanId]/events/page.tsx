import { notFound } from "next/navigation";
import { getClanEvents } from "@/app/actions/clan";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { CalendarIcon, UserIcon } from "lucide-react";
import { getServerAuthSession } from "@/server/auth";

export default async function ClanEventsPage({ params }: { params: { clanId: string } }) {
	const session = await getServerAuthSession();
	if (!session || !session.user) {
		notFound();
	}

	let clanEvents;
	try {
		clanEvents = await getClanEvents(params.clanId);
	} catch (error) {
		if (error instanceof Error && error.message === "You are not a member of this clan") {
			notFound();
		}
		throw error;
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
									<span className="text-sm">Created by: {event.creator.name}</span>
								</div>
							</CardContent>
							<CardFooter>
								<Link href={`/events/${event.id}`} passHref>
									<Button variant="outline" className="w-full">View Event</Button>
								</Link>
							</CardFooter>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

