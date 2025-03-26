"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Trophy, Users, Calendar, TrendingUp, RefreshCw } from "lucide-react"
import { getWomEvents, joinWomEvent } from "@/app/actions/wom-integration"
import type { WomEvent } from "@/types/wom-types"

interface WomEventsSectionProps {
  userId: string
  runescapeName?: string | null
  womLinked: boolean
}

export function WomEventsSection({ userId, runescapeName, womLinked }: WomEventsSectionProps) {
  const [events, setEvents] = useState<WomEvent[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isJoining, setIsJoining] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState("upcoming")

  useEffect(() => {
    if (womLinked) {
      fetchEvents()
    }
  }, [womLinked])

  const fetchEvents = async () => {
    setIsLoading(true)
    try {
      const fetchedEvents = await getWomEvents()
      setEvents(fetchedEvents)
    } catch (error) {
      console.error("Failed to fetch WOM events:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleJoinEvent = async (eventId: string) => {
    if (!runescapeName) return

    setIsJoining(eventId)
    try {
      await joinWomEvent(eventId, runescapeName)
      // Refresh events to update the joined status
      await fetchEvents()
    } catch (error) {
      console.error("Failed to join event:", error)
    } finally {
      setIsJoining(null)
    }
  }

  if (!womLinked) {
    return null
  }

  const upcomingEvents = events.filter((e) => e.status === "upcoming")
  const ongoingEvents = events.filter((e) => e.status === "ongoing")
  const finishedEvents = events.filter((e) => e.status === "finished").slice(0, 5)

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Wise Old Man Events
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={fetchEvents}
            disabled={isLoading}
            className="flex items-center gap-1"
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>Join competitions and track your progress against other players</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="upcoming" value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">
              Upcoming
              {upcomingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {upcomingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="ongoing">
              Ongoing
              {ongoingEvents.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {ongoingEvents.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="finished">Recent</TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="space-y-4 pt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <>
              <TabsContent value="upcoming" className="space-y-4 pt-4">
                {upcomingEvents.length > 0 ? (
                  upcomingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onJoin={handleJoinEvent}
                      isJoining={isJoining === event.id}
                      runescapeName={runescapeName}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No upcoming events found</div>
                )}
              </TabsContent>

              <TabsContent value="ongoing" className="space-y-4 pt-4">
                {ongoingEvents.length > 0 ? (
                  ongoingEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onJoin={handleJoinEvent}
                      isJoining={isJoining === event.id}
                      runescapeName={runescapeName}
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No ongoing events found</div>
                )}
              </TabsContent>

              <TabsContent value="finished" className="space-y-4 pt-4">
                {finishedEvents.length > 0 ? (
                  finishedEvents.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onJoin={handleJoinEvent}
                      isJoining={isJoining === event.id}
                      runescapeName={runescapeName}
                      isFinished
                    />
                  ))
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No recent events found</div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </CardContent>
    </Card>
  )
}

interface EventCardProps {
  event: WomEvent
  onJoin: (eventId: string) => void
  isJoining: boolean
  runescapeName?: string | null
  isFinished?: boolean
}

function EventCard({ event, onJoin, isJoining, runescapeName, isFinished }: EventCardProps) {
  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const isParticipating = event.participants?.some((p) => p.username.toLowerCase() === runescapeName?.toLowerCase())

  return (
    <div className="border rounded-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-medium">{event.title}</h3>
          <p className="text-sm text-muted-foreground capitalize">{event.metric.replace("_", " ")}</p>
        </div>
        <Badge variant={event.status === "upcoming" ? "outline" : event.status === "ongoing" ? "secondary" : "default"}>
          {event.status}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="flex items-center gap-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span>
            {formatDate(event.startsAt)} - {formatDate(event.endsAt)}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{event.participantCount} participants</span>
        </div>
      </div>

      {!isFinished && runescapeName && (
        <div className="pt-1">
          {isParticipating ? (
            <Button variant="outline" className="w-full" asChild>
              <a href={`https://wiseoldman.net/competitions/${event.id}`} target="_blank" rel="noopener noreferrer">
                <TrendingUp className="mr-2 h-4 w-4" />
                View Progress
              </a>
            </Button>
          ) : (
            <Button variant="default" className="w-full" onClick={() => onJoin(event.id)} disabled={isJoining}>
              {isJoining ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Trophy className="mr-2 h-4 w-4" />
                  Join Competition
                </>
              )}
            </Button>
          )}
        </div>
      )}

      {isFinished && (
        <Button variant="outline" className="w-full" asChild>
          <a href={`https://wiseoldman.net/competitions/${event.id}`} target="_blank" rel="noopener noreferrer">
            View Results
          </a>
        </Button>
      )}
    </div>
  )
}

