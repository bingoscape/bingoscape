import { getUserClans } from "../actions/clan";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import CreateClanModal from "@/components/create-clan-modal";
import { getServerAuthSession } from "@/server/auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users } from "lucide-react";
import Link from "next/link";

export default async function ClansPage() {
  const session = await getServerAuthSession();
  if (!session || !session.user) {
    notFound();
  }

  const userClans = await getUserClans();

  return (
    <div className="container mx-auto py-10">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Your Clans</h1>
        <CreateClanModal />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {userClans.map((userClan) => (
          <Card key={userClan.clan.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle>{userClan.clan.name}</CardTitle>
                  <CardDescription>{userClan.isMain ? "Main Clan" : "Guest Clan"}</CardDescription>
                </div>
                <Badge variant={userClan.isMain ? "default" : "secondary"}>
                  {userClan.isMain ? "Main" : "Guest"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">{userClan.clan.description}</p>
              <div className="flex items-center space-x-2 mb-2">
                <Crown className="h-4 w-4" />
                <span className="text-sm font-medium">Owner:</span>
                <Avatar className="h-6 w-6">
                  <AvatarImage src={userClan.owner.image || undefined} alt={userClan.owner.name || ''} />
                  <AvatarFallback>{userClan.owner.runescapeName?.[0] || 'O'}</AvatarFallback>
                </Avatar>
                <span className="text-sm">{userClan.owner.runescapeName || userClan.owner.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Users className="h-4 w-4" />
                <span className="text-sm font-medium">Members:</span>
                <span className="text-sm">{userClan.memberCount}</span>
              </div>
            </CardContent>
            <CardFooter>
              <Link href={`/clans/${userClan.clan.id}`} passHref>
                <Button variant="outline">View Clan</Button>
              </Link>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
