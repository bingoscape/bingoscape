import { getClanDetails, getClanEvents } from "@/app/actions/clan";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import ClanEventsClient from "@/components/clan-events";

export default async function ClanEventsPage({ params }: { params: { clanId: string } }) {
	try {
		const [events, clanDetails] = await Promise.all([
			getClanEvents(params.clanId),
			getClanDetails(params.clanId)
		]);

		const breadcrumbItems = [
			{ label: 'Home', href: '/' },
			{ label: 'Clans', href: '/' },
			{ label: clanDetails.name ?? '', href: `/clans/${params.clanId}` },
			{ label: 'Events', href: `/clans/${params.clanId}/events` },
		];

		return (
			<div className="container mx-auto py-10">
				<Breadcrumbs items={breadcrumbItems} />
				<h1 className="text-3xl font-bold mb-6">Clan Events</h1>
				<ClanEventsClient initialEvents={events} clanId={params.clanId} />
			</div>
		);
	} catch (error) {
		if (error instanceof Error && error.message === "You are not a member of this clan") {
			notFound();
		}
		throw error; // This will be caught by the closest error boundary
	}
}
