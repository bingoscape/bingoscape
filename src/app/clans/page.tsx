import { getUserClans } from "../actions/clan";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import CreateClanModal from "@/components/create-clan-modal";
import { getServerAuthSession } from "@/server/auth";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Crown, Users, Activity, TrendingUp, Calendar } from "lucide-react";
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
        <h1 className="text-4xl font-bold">Your Clans</h1>
        <CreateClanModal />
      </div>
      {userClans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-2xl" />
            <div className="relative w-32 h-32 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center">
              <Users className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h2 className="text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            No Clans Yet
          </h2>
          <p className="text-lg text-muted-foreground max-w-md mb-8 leading-relaxed">
            Join or create a clan to compete with other players and organize bingo events together.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <CreateClanModal />
            <Button variant="outline" size="lg" className="min-w-[140px]">
              Browse Clans
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userClans.map((userClan) => (
            <Card key={userClan.clan.id} className="group hover:shadow-lg transition-all duration-300 border-2 hover:border-primary/20 bg-gradient-to-br from-card to-card/50 overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/60 to-accent/60" />
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-start space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                      <Activity className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors duration-300">
                        {userClan.clan.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {userClan.isMain ? "Main Clan" : "Guest Clan"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge variant={userClan.isMain ? "default" : "secondary"} className="shadow-sm">
                    {userClan.isMain ? "Main" : "Guest"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {userClan.clan.description || "No description available"}
                </p>
                
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2 p-2 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-muted-foreground">Owner:</span>
                    <Avatar className="h-6 w-6 ring-2 ring-primary/20">
                      <AvatarImage src={userClan.owner.image ?? undefined} alt={userClan.owner.name ?? ''} />
                      <AvatarFallback className="text-xs">{userClan.owner.runescapeName?.[0] ?? 'O'}</AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate">
                      {userClan.owner.runescapeName ?? userClan.owner.name}
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-muted-foreground">Members:</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="text-sm font-bold">{userClan.memberCount}</span>
                      <TrendingUp className="h-3 w-3 text-green-600" />
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4 text-purple-600" />
                      <span className="text-sm font-medium text-muted-foreground">Events:</span>
                    </div>
                    <span className="text-sm font-bold">{userClan.eventCount || 0}</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Link href={`/clans/${userClan.clan.id}`} passHref className="w-full">
                  <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
                    View Clan
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
