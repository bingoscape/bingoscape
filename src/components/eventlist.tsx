import { CreateEventModal } from "./create-event-modal"
import { getEvents } from "@/app/actions/events"
import { EventDisplay } from "./events-display"
import { Button } from "@/components/ui/button"
import { Plus, TrendingUp, Users, Trophy } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default async function EventList({ userId }: { userId: string }) {
  const allEvents = await getEvents(userId)

  const hasEvents = allEvents.length > 0

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10 rounded-2xl" />
        <div className="relative bg-gradient-to-r from-card to-muted/50 rounded-2xl p-8 lg:p-12">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-3 rounded-full">
                  <Trophy className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                    Your Events
                  </h1>
                  <p className="text-lg text-muted-foreground mt-2">Manage and track your RuneScape bingo events</p>
                </div>
              </div>
              {!hasEvents && (
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-blue-700 dark:text-blue-300 font-medium">👋 Welcome to BingoScape!</p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm mt-1">
                    Create your first event to start organizing epic bingo competitions with your clan or friends.
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <CreateEventModal />
              <Button variant="outline" size="lg" asChild>
                <a href="/templates">
                  <Users className="h-4 w-4 mr-2" />
                  Browse Templates
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats - only show if user has events */}
      {hasEvents && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-500" />
                Total Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">{allEvents.length}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all time periods</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                Active Events
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {allEvents.filter(e => {
                  const now = new Date()
                  const start = new Date(e.event.startDate)
                  const end = new Date(e.event.endDate)
                  return now >= start && now <= end
                }).length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Currently running</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4 text-yellow-500" />
                Total Prize Pool
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {(() => {
                  const total = allEvents.reduce((sum, event) => sum + event.totalPrizePool, 0)
                  if (total >= 1000000000) return `${(total / 1000000000).toFixed(1)}B`
                  if (total >= 1000000) return `${(total / 1000000).toFixed(1)}M`
                  if (total >= 1000) return `${(total / 1000).toFixed(1)}K`
                  return total.toString()
                })()}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all events</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-purple-500" />
                Total Bingos
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="text-3xl font-bold">
                {allEvents.reduce((sum, event) => sum + (event.event.bingos?.length ?? 0), 0)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Across all events</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Events Display */}
      <div className={hasEvents ? "" : "max-w-6xl mx-auto"}>
        <EventDisplay initialEvents={allEvents} />
      </div>
    </div>
  )
}

