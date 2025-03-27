"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PrizePoolDisplay } from "./prize-pool-display"
import type { EventData } from "@/app/actions/events"
import { CalendarIcon, Users, Trophy, ArrowRight, Clock, CheckCircle2, XCircle, Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { requestToJoinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"

interface EventCardProps {
  eventData: EventData
  onJoin?: () => void
  isParticipant: boolean
  status?: "active" | "upcoming" | "past"
  registrationStatus?: {
    status: "not_requested" | "pending" | "approved" | "rejected"
    message?: string
    responseMessage?: string
  }
}

export function EventCard({ eventData, onJoin, isParticipant, status, registrationStatus }: EventCardProps) {
  const startDate = new Date(eventData.event.startDate)
  const endDate = new Date(eventData.event.endDate)
  const registrationDeadline = eventData.event.registrationDeadline
    ? new Date(eventData.event.registrationDeadline)
    : null
  const isRegistrationClosed = !!registrationDeadline && new Date() > registrationDeadline
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestMessage, setRequestMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const getStatusBadge = () => {
    if (!status) return null

    switch (status) {
      case "active":
        return <Badge className="bg-green-500 hover:bg-green-600">Active</Badge>
      case "upcoming":
        return <Badge className="bg-blue-500 hover:bg-blue-600">Upcoming</Badge>
      case "past":
        return <Badge className="bg-gray-500 hover:bg-gray-600">Completed</Badge>
      default:
        return null
    }
  }

  const handleRequestSubmit = async () => {
    setIsSubmitting(true)
    try {
      await requestToJoinEvent(eventData.event.id, requestMessage)
      toast({
        title: "Request submitted",
        description: "Your registration request has been submitted for review.",
      })
      setShowRequestForm(false)

      // Navigate to the registration status page
      router.push(`/events/${eventData.event.id}/status`)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to submit request",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleJoinClick = async () => {
    if (eventData.event.requiresApproval) {
      // If approval is required, show the request form
      setShowRequestForm(true)
    } else {
      // If no approval needed, join directly
      if (onJoin) {
        try {
          onJoin()
          // After successful join, redirect to the event page
          router.push(`/events/${eventData.event.id}`)
        } catch (error) {
          toast({
            title: "Error",
            description: error instanceof Error ? error.message : "Failed to join event",
            variant: "destructive",
          })
        }
      }
    }
  }

  const renderRegistrationStatus = () => {
    if (!registrationStatus || registrationStatus.status === "not_requested") return null

    switch (registrationStatus.status) {
      case "pending":
        return (
          <div className="mt-2 flex items-center text-yellow-500">
            <Clock3 className="h-4 w-4 mr-1" />
            <span className="text-sm">Registration pending approval</span>
          </div>
        )
      case "approved":
        return (
          <div className="mt-2 flex items-center text-green-500">
            <CheckCircle2 className="h-4 w-4 mr-1" />
            <span className="text-sm">Registration approved</span>
          </div>
        )
      case "rejected":
        return (
          <div className="mt-2 flex items-center text-red-500">
            <XCircle className="h-4 w-4 mr-1" />
            <span className="text-sm">Registration rejected</span>
            {registrationStatus.responseMessage && (
              <div className="mt-1 text-xs text-muted-foreground">Reason: {registrationStatus.responseMessage}</div>
            )}
          </div>
        )
    }
  }

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <div className="relative">
        {eventData.totalPrizePool > 0 && (
          <div className="absolute left-4 top-4 z-10">
            <PrizePoolDisplay prizePool={eventData.totalPrizePool} variant="badge" />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex justify-between items-start">
            <div className={`${eventData.totalPrizePool > 0 ? "mt-6" : ""}`}>
              <CardTitle className="text-xl font-bold">{eventData.event.title}</CardTitle>
              <CardDescription className="flex items-center mt-1">
                <CalendarIcon className="h-3.5 w-3.5 mr-1" />
                {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
              </CardDescription>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>
      </div>
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
              <span>{eventData.event.bingos?.length ?? 0} Bingos</span>
            </div>

            {registrationDeadline && (
              <div className="flex items-center text-muted-foreground">
                <Clock className="h-3.5 w-3.5 mr-1" />
                <span>Registration: {registrationDeadline.toLocaleDateString()}</span>
                {isRegistrationClosed && <span className="ml-1 text-destructive">(Closed)</span>}
              </div>
            )}
          </div>

          {eventData.event.requiresApproval && !isParticipant && (
            <div className="flex items-center text-amber-500">
              <Clock className="h-3.5 w-3.5 mr-1" />
              <span>Requires approval to join</span>
            </div>
          )}

          {renderRegistrationStatus()}

          {showRequestForm && (
            <div className="mt-3 space-y-2">
              <Textarea
                placeholder="Why do you want to join this event? (Optional)"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="h-24"
              />
              <div className="flex justify-end space-x-2">
                <Button variant="outline" onClick={() => setShowRequestForm(false)}>
                  Cancel
                </Button>
                <Button onClick={handleRequestSubmit} disabled={isSubmitting}>
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex justify-between pt-3 border-t">
        <Link href={`/events/${eventData.event.id}`} className="w-full">
          <Button variant="outline" className="w-full flex justify-between items-center">
            <span>View Event</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
        {!isParticipant && !isRegistrationClosed && !eventData.event.locked && (
          <>
            {eventData.event.requiresApproval ? (
              registrationStatus?.status === "pending" ? (
                <Link href={`/events/${eventData.event.id}/status`} className="ml-2">
                  <Button variant="outline">View Status</Button>
                </Link>
              ) : registrationStatus?.status === "rejected" ? (
                <Link href={`/events/${eventData.event.id}/status`} className="ml-2">
                  <Button variant="outline">View Status</Button>
                </Link>
              ) : (
                <Button onClick={handleJoinClick} className="ml-2">
                  Request to Join
                </Button>
              )
            ) : (
              <Button onClick={handleJoinClick} className="ml-2">
                Join
              </Button>
            )}
          </>
        )}
        {!isParticipant && (isRegistrationClosed ?? eventData.event.locked) && (
          <Button disabled className="ml-2" title="Registration is closed">
            Closed
          </Button>
        )}
      </CardFooter>
    </Card>
  )
}

