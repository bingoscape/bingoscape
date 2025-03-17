"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PrizePoolDisplay } from "./prize-pool-display"
import type { EventData } from "@/app/actions/events"
import { CalendarIcon, Users, Trophy, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface EventCardProps {
  eventData: EventData
  onJoin?: () => void
  isParticipant: boolean
  status?: "running" | "upcoming" | "past"
}

export function EventCard({ eventData, onJoin, isParticipant, status }: EventCardProps) {
  const startDate = new Date(eventData.event.startDate)
  const endDate = new Date(eventData.event.endDate)

  const getStatusBadge = () => {
    if (!status) return null

    switch (status) {
      case "running":
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
      case "upcoming":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Upcoming</Badge>
      case "past":
        return <Badge className="bg-gray-500 hover:bg-gray-600">Completed</Badge>
      default:
        return null
    }
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl font-bold">{eventData.event.title}</CardTitle>
            <CardDescription className="flex items-center mt-1">
              <CalendarIcon className="h-3.5 w-3.5 mr-1" />
              {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
            </CardDescription>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="pb-2">
        <div className="space-y-3">
          {eventData.event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{eventData.event.description}</p>
          )}

          <div className="flex flex-wrap gap-3 text-sm">
            {eventData.event.clan && (
              <div className="flex items-center text-muted-foreground">
                <Users className="h-3.5 w-3.5 mr-1" />
                <span>{eventData.event.clan?.name}</span>
              </div>
            )}

            <div className="flex items-center text-muted-foreground">
              <Trophy className="h-3.5 w-3.5 mr-1" />
              <span>{eventData.event.bingos?.length ?? 0} Boards</span>
            </div>

            <div className="ml-auto">
              <PrizePoolDisplay prizePool={eventData.totalPrizePool} />
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-3 border-t">
        <Link href={`/events/${eventData.event.id}`} className="w-full">
          <Button variant="outline" className="w-full flex justify-between items-center">
            <span>View Event</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        {!isParticipant && (
          <Button onClick={onJoin} className="ml-2">
            Join
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

