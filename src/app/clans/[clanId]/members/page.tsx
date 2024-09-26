import { notFound } from "next/navigation";
import { getClanDetails, getClanMembers } from "@/app/actions/clan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { getServerAuthSession } from "@/server/auth";

export default async function ClanMembersPage({ params }: { params: { clanId: string } }) {
	const session = await getServerAuthSession();
	if (!session || !session.user) {
		notFound();
	}

	let clanDetails;
	try {
		clanDetails = await getClanDetails(params.clanId);
	} catch (error) {
		if (error instanceof Error && error.message === "You are not a member of this clan") {
			notFound();
		}
		throw error;
	}

	const members = await getClanMembers(params.clanId);

	return (
		<div className="container mx-auto py-10">
			<Card>
				<CardHeader>
					<CardTitle>{clanDetails.name} - Members</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="space-y-4">
						{members.map((member) => (
							<li key={member.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
								<div className="flex items-center space-x-4">
									<Avatar className="h-10 w-10">
										<AvatarImage src={member.image || undefined} alt={member.name || ''} />
										<AvatarFallback>{member.name?.[0] || 'U'}</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium">{member.runescapeName || member.name}</p>
										{member.runescapeName && member.name !== member.runescapeName && (
											<p className="text-sm text-muted-foreground">{member.name}</p>
										)}
									</div>
								</div>
								<Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
							</li>
						))}
					</ul>
				</CardContent>
			</Card>
		</div>
	);
}

function getRoleBadgeVariant(role: string): "default" | "secondary" | "destructive" | "outline" {
	switch (role) {
		case 'admin':
			return "destructive";
		case 'management':
			return "default";
		case 'member':
			return "secondary";
		case 'guest':
			return "outline";
		default:
			return "secondary";
	}
}

