'use client'

import { notFound, useRouter } from "next/navigation";
import { getClanDetails, getClanMembers, updateMemberRole } from "@/app/actions/clan";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { UserIcon, CalendarIcon, Users } from "lucide-react";
import { GenerateClanInviteLink } from "@/components/generate-clan-invite-link";
import { useSession } from "next-auth/react";
import { useState, useEffect } from "react";
import { toast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Breadcrumbs } from "@/components/breadcrumbs";

type ClanMember = {
  id: string;
  name: string | null;
  runescapeName: string | null;
  image: string | null;
  role: 'admin' | 'management' | 'member' | 'guest';
};

type ClanDetails = {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  eventCount: number;
  userMembership: {
    id: string;
    userId: string;
    clanId: string;
    role: 'admin' | 'management' | 'member' | 'guest';
    isMain: boolean;
    joinedAt: Date;
  };
  owner: {
    id: string;
    name: string | null;
    image: string | null;
    runescapeName: string | null;
  };
};

type Role = 'admin' | 'management' | 'member' | 'guest';

export default function ClanDetailPage({ params }: { params: { clanId: string } }) {
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [clanDetails, setClanDetails] = useState<ClanDetails | null>(null);
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
        const details = await getClanDetails(params.clanId);
        if (details?.id) {
          setClanDetails(details as ClanDetails);
        } else {
          throw new Error("Invalid clan details");
        }

        const membersList = await getClanMembers(params.clanId);
        setMembers(membersList);
      } catch (error) {
        if (error instanceof Error && error.message === "You are not a member of this clan") {
          notFound();
        }
        toast({
          title: "Error",
          description: "Failed to load clan details and members.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData().then(() => console.log("done")).catch(err => console.error(err));
  }, [params.clanId, status, router]);

  const handleRoleUpdate = async (memberId: string, newRole: Role) => {
    try {
      await updateMemberRole(params.clanId, memberId, newRole);
      const updatedMembers = await getClanMembers(params.clanId);
      setMembers(updatedMembers);
      toast({
        title: "Role Updated",
        description: `The member's role has been successfully updated to ${newRole}.`,
      });
    } catch (_) {
      toast({
        title: "Error",
        description: "Failed to update member's role. Please try again.",
        variant: "destructive",
      });
    }
  };

  const canChangeRole = (userRole: Role, memberRole: Role) => {
    const roles: Role[] = ['guest', 'member', 'management', 'admin'];
    const userRoleIndex = roles.indexOf(userRole);
    const memberRoleIndex = roles.indexOf(memberRole);
    return userRoleIndex > memberRoleIndex;
  };

  const getAdjacentRoles = (currentRole: Role): { promote: Role | null, demote: Role | null } => {
    const roles: Role[] = ['guest', 'member', 'management', 'admin'];
    const currentIndex = roles.indexOf(currentRole);
    return {
      promote: currentIndex < roles.length - 1 ? roles[currentIndex + 1]! : null,
      demote: currentIndex > 0 ? roles[currentIndex - 1]! : null,
    };
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-1/3" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-4 w-full mb-2" />
            <Skeleton className="h-4 w-2/3 mb-4" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // The useEffect will handle the redirect
  }

  if (!clanDetails) {
    return <div>Clan not found</div>;
  }

  const isOwnerOrAdmin = clanDetails.userMembership.role === 'admin' || clanDetails.userMembership.role === 'management';

  const breadcrumbItems = [
    { label: 'Home', href: '/' },
    { label: 'Clans', href: '/' },
    { label: clanDetails.name, href: `/clans/${clanDetails.id}` },
  ];

  return (
    <div className="container mx-auto py-10 space-y-5">
      <Breadcrumbs items={breadcrumbItems} />
      <Card>
        <CardHeader>
          <CardTitle>{clanDetails.name}</CardTitle>
          <CardDescription>{clanDetails.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-row justify-between">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Users className="h-4 w-4" />
                <span>Members: {clanDetails.memberCount}</span>
              </div>
              <div className="flex items-center space-x-2 mb-4">
                <CalendarIcon className="h-4 w-4" />
                <span>Events: {clanDetails.eventCount}</span>
              </div>
              <div className="flex items-center space-x-2 mb-6">
                <UserIcon className="h-4 w-4" />
                <span>Owner:</span>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={clanDetails.owner.image ?? undefined} alt={clanDetails.owner.runescapeName ?? ''} />
                  <AvatarFallback>{clanDetails.owner?.runescapeName?.[0] ?? 'O'}</AvatarFallback>
                </Avatar>
                <span>{clanDetails.owner?.runescapeName ?? clanDetails.owner?.name}</span>
              </div>
            </div>
            {isOwnerOrAdmin && (
              <div className="mb-6">
                <GenerateClanInviteLink clanId={params.clanId} />
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Link href={`/clans/${params.clanId}/events`} passHref>
            <Button variant="outline">View Events</Button>
          </Link>
        </CardFooter>
      </Card>

      <h3 className="text-lg font-semibold mb-4">Members</h3>
      <ul className="space-y-4">
        {members.map((member) => (
          <li key={member.id} className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div className="flex items-center space-x-4">
              <Avatar className="h-10 w-10">
                <AvatarImage src={member.image ?? undefined} alt={member.name ?? ''} />
                <AvatarFallback>{member.name?.[0] ?? 'U'}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{member.runescapeName ?? member.name}</p>
                {member.runescapeName && member.name !== member.runescapeName && (
                  <p className="text-sm text-muted-foreground">{member.name}</p>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant={getRoleBadgeVariant(member.role)}>{member.role}</Badge>
              {canChangeRole(clanDetails.userMembership.role, member.role) && (
                <div className="flex space-x-2">
                  {getAdjacentRoles(member.role).promote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRoleUpdate(member.id, getAdjacentRoles(member.role).promote!)}
                    >
                      Promote to {getAdjacentRoles(member.role).promote}
                    </Button>
                  )}
                  {getAdjacentRoles(member.role).demote && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRoleUpdate(member.id, getAdjacentRoles(member.role).demote!)}
                    >
                      Demote to {getAdjacentRoles(member.role).demote}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>

    </div>
  );
}

function getRoleBadgeVariant(role: Role): "default" | "secondary" | "destructive" | "outline" {
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

