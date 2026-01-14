'use client'

import { notFound, useRouter } from "next/navigation";
import { getClanDetails, getClanMembers, updateMemberRole } from "@/app/actions/clan";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import Link from "next/link";
import { UserIcon, CalendarIcon, Users, Search, Filter, Activity, Crown, Shield, UserPlus, MessageSquare, MoreHorizontal, Link as LinkIcon } from "lucide-react";
import { GenerateClanInviteLink } from "@/components/generate-clan-invite-link";
import { ClanInvitesManagement } from "@/components/clan-invites-management";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useSession } from "next-auth/react";
import { useState, useEffect, use } from "react";
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

export default function ClanDetailPage(props: { params: Promise<{ clanId: string }> }) {
  const params = use(props.params);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [clanDetails, setClanDetails] = useState<ClanDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const { status } = useSession();
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
    { label: 'Clans', href: '/clans' },
    { label: clanDetails.name, href: `/clans/${clanDetails.id}` },
  ];

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.name?.toLowerCase().includes(searchTerm.toLowerCase()) ??
      member.runescapeName?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'admin': return Crown;
      case 'management': return Shield;
      case 'member': return UserIcon;
      case 'guest': return UserPlus;
      default: return UserIcon;
    }
  };

  const getRoleColor = (role: Role) => {
    switch (role) {
      case 'admin': return 'text-red-500';
      case 'management': return 'text-blue-500';
      case 'member': return 'text-green-500';
      case 'guest': return 'text-gray-500';
      default: return 'text-gray-500';
    }
  };

  return (
    <div className="container mx-auto py-10 space-y-6">
      <Breadcrumbs items={breadcrumbItems} />

      {/* Clan Header */}
      <Card className="overflow-hidden bg-gradient-to-br from-card to-card/50 border-2">
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-accent" />
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                <Activity className="h-10 w-10 text-primary" />
              </div>
              <div>
                <CardTitle className="text-2xl">{clanDetails.name}</CardTitle>
                <CardDescription className="text-base mt-1">
                  {clanDetails.description || "No description available"}
                </CardDescription>
              </div>
            </div>
            <div className="flex space-x-2">
              {isOwnerOrAdmin && (
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline">
                      <LinkIcon className="mr-2 h-4 w-4" />
                      Manage Invites
                    </Button>
                  </SheetTrigger>
                  <SheetContent className="w-full sm:max-w-4xl overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Clan Invite Links</SheetTitle>
                      <SheetDescription>
                        Create and manage invite links for {clanDetails.name}
                      </SheetDescription>
                    </SheetHeader>
                    <div className="space-y-6 py-6">
                      {/* Invite Creation Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Create New Invite</CardTitle>
                          <CardDescription>
                            Generate a customizable invite link with optional expiration and usage limits
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <GenerateClanInviteLink clanId={params.clanId} />
                        </CardContent>
                      </Card>

                      {/* Invite Management Section */}
                      <Card>
                        <CardHeader>
                          <CardTitle>Active Invites</CardTitle>
                          <CardDescription>
                            View and manage all invite links for this clan
                          </CardDescription>
                        </CardHeader>
                        <CardContent>
                          <ClanInvitesManagement clanId={params.clanId} />
                        </CardContent>
                      </Card>
                    </div>
                  </SheetContent>
                </Sheet>
              )}
              <Link href={`/clans/${params.clanId}/events`} passHref>
                <Button variant="outline">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  View Events
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/30">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Members</p>
                <p className="text-2xl font-bold">{clanDetails.memberCount}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/30">
              <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                <CalendarIcon className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Events</p>
                <p className="text-2xl font-bold">{clanDetails.eventCount}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-4 rounded-lg bg-secondary/30">
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Crown className="h-5 w-5 text-yellow-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Owner</p>
                <div className="flex items-center space-x-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src={clanDetails.owner.image ?? undefined} alt={clanDetails.owner.runescapeName ?? ''} />
                    <AvatarFallback className="text-xs">{clanDetails.owner?.runescapeName?.[0] ?? 'O'}</AvatarFallback>
                  </Avatar>
                  <span className="font-semibold text-sm">
                    {clanDetails.owner?.runescapeName ?? clanDetails.owner?.name}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
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

