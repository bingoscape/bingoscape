import EventList from "@/components/eventlist"
import { LoginCard } from "@/components/login"
import { getServerAuthSession } from "@/server/auth"
import { Trophy, Users, Calendar } from "lucide-react"

export default async function HomePage() {
  const session = await getServerAuthSession()

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8">
        {session ? (
          <div className="space-y-8">
            <EventList userId={session.user.id} />
          </div>
        ) : (
          <div className="flex flex-col md:flex-row gap-12 items-center justify-between py-12">
            <div className="space-y-6 max-w-xl">
              <h1 className="text-4xl md:text-5xl font-bold text-primary">BingoScape</h1>
              <p className="text-xl text-muted-foreground">
                Create, manage, and participate in RuneScape bingo events with your friends and clan.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-4">
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                  <Trophy className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-medium">Compete</h3>
                  <p className="text-sm text-center text-muted-foreground">Participate in bingo events</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                  <Users className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-medium">Team Up</h3>
                  <p className="text-sm text-center text-muted-foreground">Form teams with friends</p>
                </div>
                <div className="flex flex-col items-center p-4 bg-muted/50 rounded-lg">
                  <Calendar className="h-8 w-8 text-primary mb-2" />
                  <h3 className="font-medium">Track Progress</h3>
                  <p className="text-sm text-center text-muted-foreground">Monitor your achievements</p>
                </div>
              </div>

              <div className="pt-4">
                <LoginCard />
                <p className="text-sm text-muted-foreground mt-4">
                  New to BingoScape? Sign in to create your account and get started.
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-md">
              <div className="aspect-square rounded-lg bg-muted/30 p-1 backdrop-blur-sm border">
                <div className="h-full w-full rounded-md bg-muted/80 flex items-center justify-center">
                  <img
                    src="/placeholder.svg?height=400&width=400"
                    alt="BingoScape Preview"
                    className="max-w-full max-h-full object-contain"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

