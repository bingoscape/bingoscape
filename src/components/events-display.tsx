"use client"

import { useState } from "react"
import type { EventData } from "@/app/actions/events"
import { EventCard } from "@/components/event-card"
import { Button } from "@/components/ui/button"
import { LayoutGrid, List, Calendar, Clock, Archive, Layers, Check, CheckCircle2 } from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import formatRunescapeGold from "@/lib/formatRunescapeGold"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface EventDisplayProps {
  initialEvents: EventData[]
}

export function EventDisplay({ initialEvents }: EventDisplayProps) {
  const [events] = useState<EventData[]>(initialEvents)
  const [isGridView, setIsGridView] = useState(true)
  const [activeTab, setActiveTab] = useState("active")

  const categorizeEvents = (events: EventData[]) => {
    const now = new Date()
    return events.reduce(
      (acc, eventData) => {
        const startDate = new Date(eventData.event.startDate)
        const endDate = new Date(eventData.event.endDate)
        if (now >= startDate && now <= endDate) {
          acc.active.push(eventData)
        } else if (now < startDate) {
          acc.upcoming.push(eventData)
        } else {
          acc.past.push(eventData)
        }
        return acc
      },
      { active: [], upcoming: [], past: [] } as { active: EventData[]; upcoming: EventData[]; past: EventData[] },
    )
  }

  const { active, upcoming, past } = categorizeEvents(events)

  // Calculate stats
  const totalEvents = events.length
  const activeEvents = active.length
  const totalPrizePool = events.reduce((sum, event) => sum + event.totalPrizePool, 0)

  const renderEventTable = (eventsList: EventData[]) => (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="hidden md:table-cell"># Bingos</TableHead>
            <TableHead className="hidden md:table-cell">Start Date</TableHead>
            <TableHead className="hidden md:table-cell">End Date</TableHead>
            <TableHead className="hidden lg:table-cell">Clan</TableHead>
            <TableHead>Prize Pool</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {eventsList.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-center text-muted-foreground py-6">
                No events found
              </TableCell>
            </TableRow>
          ) : (
            eventsList.map((ed) => {
              // Determine status for each event
              const now = new Date()
              const startDate = new Date(ed.event.startDate)
              const endDate = new Date(ed.event.endDate)
              let status: "active" | "upcoming" | "past"

              if (now >= startDate && now <= endDate) {
                status = "active"
              } else if (now < startDate) {
                status = "upcoming"
              } else {
                status = "past"
              }

              return (
                <TableRow key={ed.event.id}>
                  <TableCell className="font-medium">{ed.event.title}</TableCell>
                  <TableCell className="hidden md:table-cell">{ed.event.bingos?.length ?? 0}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(ed.event.startDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {new Date(ed.event.endDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{ed.event.clan?.name ?? "No clan"}</TableCell>
                  <TableCell>{formatRunescapeGold(ed.totalPrizePool)}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${status === "active"
                        ? "bg-green-500 text-white"
                        : status === "upcoming"
                          ? "bg-blue-500 text-white"
                          : "bg-muted text-muted-foreground"
                        }`}
                    >
                      {status === "active" ? "Active" : status === "upcoming" ? "Upcoming" : "Completed"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/events/${ed.event.id}`}>View</a>
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })
          )}
        </TableBody>
      </Table>
    </div>
  )

  const renderEventGrid = (eventsList: EventData[], forcedStatus?: "active" | "upcoming" | "past") => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {eventsList.length === 0 ? (
        <div className="col-span-full">
          <div className="text-center py-12 bg-muted/20 rounded-lg border-2 border-dashed border-muted">
            <div className="space-y-3">
              <div className="bg-muted/50 p-3 rounded-full w-fit mx-auto">
                <Archive className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="text-muted-foreground font-medium">No events found</p>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                {activeTab === "active" && "No events are currently running. Create a new event to get started!"}
                {activeTab === "upcoming" && "No events are scheduled for the future. Plan your next bingo competition!"}
                {activeTab === "past" && "No completed events yet. Your event history will appear here."}
                {activeTab === "all" && "No events created yet. Get started by creating your first bingo event!"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        eventsList.map((ed) => {
          // Determine status for each event when in "all" tab
          let status = forcedStatus
          if (!status) {
            const now = new Date()
            const startDate = new Date(ed.event.startDate)
            const endDate = new Date(ed.event.endDate)

            if (now >= startDate && now <= endDate) {
              status = "active"
            } else if (now < startDate) {
              status = "upcoming"
            } else {
              status = "past"
            }
          }

          return (
            <EventCard
              key={ed.event.id}
              eventData={ed}
              isParticipant={true}
              status={status}
              // eslint-disable-next-line @typescript-eslint/no-empty-function
              onJoin={() => { }}
            />
          )
        })
      )}
    </div>
  )

  const getEventsForTab = () => {
    switch (activeTab) {
      case "active":
        return active
      case "upcoming":
        return upcoming
      case "past":
        return past
      default:
        return events
    }
  }

  const getStatusForTab = () => {
    switch (activeTab) {
      case "active":
        return "active" as const
      case "upcoming":
        return "upcoming" as const
      case "past":
        return "past" as const
      default:
        return undefined
    }
  }

  // If no events, show getting started section
  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="bg-gradient-to-r from-muted/50 to-card rounded-2xl p-8 lg:p-12">
          <div className="max-w-md mx-auto space-y-6">
            <div className="bg-primary/10 p-4 rounded-full w-fit mx-auto">
              <Calendar className="h-12 w-12 text-primary" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">No Events Yet</h2>
              <p className="text-muted-foreground">
                Get started by creating your first bingo event. Organize competitions, set up prizes, and invite your clan members!
              </p>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full" />
                <span>Create custom bingo boards</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                <span>Set up prize pools and rewards</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                <span>Invite clan members and friends</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      <div className="bg-card/50 rounded-xl p-6 border">
        <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">Event Management</h2>
              <p className="text-sm text-muted-foreground">Browse and manage your bingo events</p>
            </div>
            <div className="flex items-center gap-2">
              <TabsList className="grid w-full grid-cols-4 lg:w-auto">
                <TabsTrigger value="active" className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Active</span>
                  {active.length > 0 && (
                    <span className="ml-1 text-xs bg-green-500/20 text-green-700 dark:text-green-300 rounded-full px-1.5">{active.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  <span className="hidden sm:inline">Upcoming</span>
                  {upcoming.length > 0 && (
                    <span className="ml-1 text-xs bg-blue-500/20 text-blue-700 dark:text-blue-300 rounded-full px-1.5">{upcoming.length}</span>
                  )}
                </TabsTrigger>
                <TabsTrigger value="past" className="flex items-center gap-1">
                  <Archive className="h-4 w-4" />
                  <span className="hidden sm:inline">Past</span>
                  {past.length > 0 && <span className="ml-1 text-xs bg-muted/60 text-muted-foreground rounded-full px-1.5">{past.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="all" className="flex items-center gap-1">
                  <Layers className="h-4 w-4" />
                  <span className="hidden sm:inline">All</span>
                </TabsTrigger>
              </TabsList>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setIsGridView(!isGridView)}
                aria-label={isGridView ? "Switch to table view" : "Switch to grid view"}
                className="shrink-0"
              >
                {isGridView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            {isGridView ? renderEventGrid(getEventsForTab(), getStatusForTab()) : renderEventTable(getEventsForTab())}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

