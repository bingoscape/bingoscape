"use client"

import { useState } from "react"
import type { EventData } from "@/app/actions/events"
import { EventCard } from "@/components/event-card"
import { Button } from "@/components/ui/button"
import { LayoutGrid, List, Calendar, Clock, Archive, Layers } from "lucide-react"
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
                        ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : status === "upcoming"
                          ? "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                          : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
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
        <div className="col-span-full text-center py-10 text-muted-foreground">No events found</div>
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all time periods</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeEvents}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently running</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Prize Pool</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatRunescapeGold(totalPrizePool)}</div>
            <p className="text-xs text-muted-foreground mt-1">Across all events</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="active" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-4">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Active</span>
              {active.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 rounded-full px-1.5">{active.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upcoming" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Upcoming</span>
              {upcoming.length > 0 && (
                <span className="ml-1 text-xs bg-primary/20 rounded-full px-1.5">{upcoming.length}</span>
              )}
            </TabsTrigger>
            <TabsTrigger value="past" className="flex items-center gap-1">
              <Archive className="h-4 w-4" />
              <span className="hidden sm:inline">Past</span>
              {past.length > 0 && <span className="ml-1 text-xs bg-primary/20 rounded-full px-1.5">{past.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="all" className="flex items-center gap-1">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">All Events</span>
            </TabsTrigger>
          </TabsList>

          <Button
            variant="outline"
            size="icon"
            onClick={() => setIsGridView(!isGridView)}
            aria-label={isGridView ? "Switch to table view" : "Switch to grid view"}
          >
            {isGridView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
          </Button>
        </div>

        <TabsContent value={activeTab} className="mt-0">
          {isGridView ? renderEventGrid(getEventsForTab(), getStatusForTab()) : renderEventTable(getEventsForTab())}
        </TabsContent>
      </Tabs>
    </div>
  )
}

