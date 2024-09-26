import { notFound } from "next/navigation";
import { getServerSession } from "next-auth/next";
import { getClanDetails } from "@/app/actions/clan";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import Link from "next/link";
import { UserIcon, CalendarIcon, Users } from "lucide-react";
import { GenerateInviteLink } from "@/components/generate-invite-link";
import { getServerAuthSession } from "@/server/auth";

export default async function ClanDetailPage({ params }: { params: { clanId: string } }) {
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

  const isOwnerOrAdmin = clanDetails.userMembership.role == 'admin' || clanDetails.userMembership.role == 'management'

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>{clanDetails.name}</CardTitle>
          <CardDescription>{clanDetails.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2 mb-4">
            <Users className="h-4 w-4" />
            <span>Members: {clanDetails.memberCount}</span>
          </div>
          <div className="flex items-center space-x-2 mb-4">
            <CalendarIcon className="h-4 w-4" />
            <span>Events: {clanDetails.eventCount}</span>
          </div>
          <div className="flex items-center space-x-2">
            <UserIcon className="h-4 w-4" />
            <span>Owner:</span>
            <Avatar className="h-8 w-8">
              <AvatarImage src={clanDetails.owner.image || undefined} alt={clanDetails.owner.runescapeName || ''} />
              <AvatarFallback>{clanDetails.owner?.runescapeName?.[0] || 'O'}</AvatarFallback>
            </Avatar>
            <span>{clanDetails.owner?.runescapeName || clanDetails.owner?.name}</span>
          </div>
          {isOwnerOrAdmin && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Invite Members</h3>
              <GenerateInviteLink clanId={params.clanId} />
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href={`/clans/${params.clanId}/members`} passHref>
            <Button variant="outline">View Members</Button>
          </Link>
          <Link href={`/clans/${params.clanId}/events`} passHref>
            <Button variant="outline">View Events</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}

