import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PrizePoolDisplay } from "./prize-pool-display"
import { type EventData } from "@/app/actions/events"

interface EventCardProps {
  eventData: EventData;
  onJoin?: () => void;
  isParticipant: boolean;
}

export function EventCard({ eventData, onJoin, isParticipant }: EventCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {eventData.event.title}
        </CardTitle>
        <CardDescription>{new Date(eventData.event.createdAt).toLocaleDateString()}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-row justify-between">
          <div>
            {eventData.event.clan && (
              <p>Clan: {eventData.event.clan?.name ?? ''}</p>
            )}
            <pre className="text-sm text-gray-600">{eventData.event.bingos?.length ?
              (`${eventData.event.bingos.length} Bingos`) : ('No bingos yet!')}</pre>
            <pre className="text-sm text-gray-600">{eventData.event.description}</pre>
          </div>
          <PrizePoolDisplay prizePool={eventData.totalPrizePool} />
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Link href={`/events/${eventData.event.id}`}>
          <Button variant="outline">View Event</Button>
        </Link>
        {(!isParticipant) && (
          <Button onClick={onJoin}>Join Event</Button>
        )}
      </CardFooter>
    </Card>
  )
}
