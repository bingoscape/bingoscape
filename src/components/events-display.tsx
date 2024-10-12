'use client'

import { useState } from "react"
import { type EventData } from "@/app/actions/events"
import { EventCard } from "@/components/event-card"
import { Button } from "@/components/ui/button"
import { LayoutGrid, List } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatRunescapeGold } from "@/lib/formatRunescapeGold"

interface EventDisplayProps {
  initialEvents: EventData[]
}

export function EventDisplay({ initialEvents }: EventDisplayProps) {
  const [events, setEvents] = useState<EventData[]>(initialEvents)
  const [isGridView, setIsGridView] = useState(false)

  const categorizeEvents = (events: EventData[]) => {
    const now = new Date()
    return events.reduce((acc, eventData) => {
      const startDate = new Date(eventData.event.startDate)
      const endDate = new Date(eventData.event.endDate)
      if (now >= startDate && now <= endDate) {
        acc.running.push(eventData)
      } else if (now < startDate) {
        acc.upcoming.push(eventData)
      } else {
        acc.past.push(eventData)
      }
      return acc
    }, { running: [], upcoming: [], past: [] } as { running: EventData[], upcoming: EventData[], past: EventData[] })
  }

  const { running, upcoming, past } = categorizeEvents(events)

  const renderEventTable = (eventsList: EventData[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead># Bingos</TableHead>
          <TableHead>Start Date</TableHead>
          <TableHead>End Date</TableHead>
          <TableHead>Clan</TableHead>
          <TableHead>Prize Pool</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {eventsList.map((ed) => (
          <TableRow key={ed.event.id}>
            <TableCell>{ed.event.title}</TableCell>
            <TableCell>{ed.event.bingos?.length ?? 0}</TableCell>
            <TableCell>{new Date(ed.event.startDate).toLocaleDateString()}</TableCell>
            <TableCell>{new Date(ed.event.endDate).toLocaleDateString()}</TableCell>
            <TableCell>{ed.event.clan?.name ?? 'no clan'}</TableCell>
            <TableCell>{formatRunescapeGold(ed.totalPrizePool)}</TableCell>
            <TableCell>
              <Button variant="outline" size="sm" asChild>
                <a href={`/events/${ed.event.id}`}>View</a>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )

  const renderEventGrid = (eventsList: EventData[]) => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {eventsList.map((ed) => (
        <EventCard
          key={ed.event.id}
          eventData={ed}
          isParticipant={true}
          // eslint-disable-next-line @typescript-eslint/no-empty-function
          onJoin={() => { }}
        />
      ))}
    </div>
  )

  const renderEventList = (eventsList: EventData[], title: string, noEventMessage: string) => (
    <section className="mb-10">
      <h2 className="text-2xl font-semibold mb-4">{title}</h2>
      {eventsList.length === 0 ? (
        <p className="text-muted-foreground">{noEventMessage}</p>
      ) : (
        isGridView ? renderEventGrid(eventsList) : renderEventTable(eventsList)
      )}
    </section>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-end mb-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsGridView(!isGridView)}
          aria-label={isGridView ? "Switch to table view" : "Switch to grid view"}
        >
          {isGridView ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
        </Button>
      </div>
      {events.length === 0 ? (
        <p className="text-muted-foreground">You do not have any events yet. Create one to get started!</p>
      ) : (
        <>
          {renderEventList(running, "Running Events", "No events are currently running.")}
          {renderEventList(upcoming, "Upcoming Events", "No upcoming events.")}
          {renderEventList(past, "Past Events", "No past events.")}
        </>
      )}
    </div>
  )
}
