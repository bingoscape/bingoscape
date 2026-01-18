import { getUserClans } from "../actions/clan"
import { notFound } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import CreateClanModal from "@/components/create-clan-modal"
import { getServerAuthSession } from "@/server/auth"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Crown, Users, BowArrow } from "lucide-react"
import Link from "next/link"

export default async function ClansPage() {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    notFound()
  }

  const userClans = await getUserClans()

  return (
    <div className="container mx-auto py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-bold">Your Clans</h1>
        <CreateClanModal />
      </div>
      {userClans.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="relative mb-8">
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-accent/20 blur-2xl" />
            <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
              <Users className="h-16 w-16 text-primary" />
            </div>
          </div>
          <h2 className="mb-4 bg-gradient-to-r from-primary to-primary/30 bg-clip-text text-3xl font-bold text-transparent">
            No Clans Yet
          </h2>
          <p className="mb-8 max-w-md text-lg leading-relaxed text-muted-foreground">
            Join or create a clan to compete with other players and organize
            bingo events together.
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <CreateClanModal />
            <Button variant="outline" size="lg" className="min-w-[140px]">
              Browse Clans
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userClans.map((userClan) => (
            <Card
              key={userClan.clan.id}
              className="relative overflow-hidden border-2 bg-gradient-to-br duration-300 hover:border-primary/20 hover:shadow-md"
            >
              <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-primary to-primary/20" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary/10 to-accent/10">
                      <BowArrow className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">
                        {userClan.clan.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {userClan.isMain ? "Main Clan" : "Guest Clan"}
                      </CardDescription>
                    </div>
                  </div>
                  <Badge
                    variant={userClan.isMain ? "default" : "secondary"}
                    className="shadow-sm"
                  >
                    {userClan.isMain ? "Main" : "Guest"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {userClan.clan.description ?? "No description available"}
                </p>

                <div className="grid grid-cols-1 gap-3">
                  <div className="flex items-center space-x-2 rounded-lg bg-secondary/30 p-2">
                    <Crown className="h-4 w-4 text-yellow-600" />
                    <span className="text-sm font-medium text-muted-foreground">
                      Owner:
                    </span>
                    <Avatar className="h-6 w-6 ring-2 ring-primary/20">
                      <AvatarImage
                        src={userClan.owner.image ?? undefined}
                        alt={userClan.owner.name ?? ""}
                      />
                      <AvatarFallback className="text-xs">
                        {userClan.owner.runescapeName?.[0] ?? "O"}
                      </AvatarFallback>
                    </Avatar>
                    <span className="truncate text-sm font-medium">
                      {userClan.owner.runescapeName ?? userClan.owner.name}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-lg bg-secondary/30 p-2">
                    <div className="flex items-center space-x-2">
                      <Users className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-muted-foreground">
                        Members:
                      </span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <span className="mr-2 text-sm font-bold">
                        {userClan.memberCount}
                      </span>
                      <Users className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="pt-2">
                <Link
                  href={`/clans/${userClan.clan.id}`}
                  passHref
                  className="w-full"
                >
                  <Button
                    variant="outline"
                    className="w-full transition-colors duration-300 hover:bg-primary hover:text-primary-foreground"
                  >
                    View Clan
                  </Button>
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
