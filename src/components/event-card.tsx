"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { PrizePoolDisplay } from "./prize-pool-display"
import type { EventData } from "@/app/actions/events"
import { CalendarIcon, Users, Trophy, ArrowRight, Clock, CheckCircle2, XCircle, Clock3, Check, AlertTriangle, Star, MapPin } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { requestToJoinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

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
        return (
          <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg shadow-green-500/25 hover:shadow-green-500/40 transition-all duration-300">
            <Check className="h-3 w-3 mr-1" />
            Active
          </Badge>
        )
      case "upcoming":
        return (
          <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 transition-all duration-300">
            <Clock className="h-3 w-3 mr-1" />
            Upcoming
          </Badge>
        )
      case "past":
        return (
          <Badge className="bg-gradient-to-r from-slate-500 to-slate-600 text-white shadow-lg shadow-slate-500/25 hover:shadow-slate-500/40 transition-all duration-300">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Completed
          </Badge>
        )
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
    <Link href={`/events/${eventData.event.id}`} className="block h-full">
      <Card className={cn(
        "group overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/20 cursor-pointer h-full flex flex-col",
        status === "past" && "opacity-90 hover:opacity-100"
      )}>
      <div className="relative">
        {/* Background gradient overlay for visual depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/50 to-background/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Prize pool display */}
        {eventData.totalPrizePool > 0 && (
          <div className="absolute left-4 top-4 z-10 transform group-hover:scale-110 transition-transform duration-300">
            <PrizePoolDisplay prizePool={eventData.totalPrizePool} variant="badge" />
          </div>
        )}

        {/* Status badge */}
        <div className="absolute right-4 top-4 z-10 transform group-hover:scale-110 transition-transform duration-300">
          {getStatusBadge()}
        </div>

        <CardHeader className="pb-3 pt-6">
          <div className="flex flex-col space-y-2">
            <div className={`${eventData.totalPrizePool > 0 ? "mt-6" : ""}`}>
              <CardTitle className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors duration-300">
                {eventData.event.title}
              </CardTitle>
              <CardDescription className="flex items-center mt-2 text-sm">
                <CalendarIcon className="h-4 w-4 mr-2 text-muted-foreground" />
                <span className="font-medium">
                  {startDate.toLocaleDateString()} - {endDate.toLocaleDateString()}
                </span>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </div>
      <CardContent className="pb-4 flex-1">
        <div className="space-y-4">
          {eventData.event.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {eventData.event.description}
            </p>
          )}

          {/* Event metadata in a structured grid */}
          <div className="grid grid-cols-2 gap-3">
            {eventData.event.clan && (
              <div className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50 group-hover:bg-muted/70 transition-colors">
                <Users className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium truncate">{eventData.event.clan?.name}</span>
              </div>
            )}

            <div className="flex items-center space-x-2 p-2 rounded-lg bg-muted/50 group-hover:bg-muted/70 transition-colors">
              <Trophy className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">{eventData.event.bingos?.length ?? 0} Bingos</span>
            </div>

            {registrationDeadline && (
              <div className="col-span-2 flex items-center space-x-2 p-2 rounded-lg bg-muted/50 group-hover:bg-muted/70 transition-colors">
                <Clock className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Registration: {registrationDeadline.toLocaleDateString()}</span>
                {isRegistrationClosed && <span className="ml-1 text-destructive font-semibold">(Closed)</span>}
              </div>
            )}
          </div>

          {eventData.event.requiresApproval && !isParticipant && (
            <div className="flex items-center space-x-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium text-amber-700 dark:text-amber-300">Requires approval to join</span>
            </div>
          )}

          {renderRegistrationStatus()}

          {showRequestForm && (
            <div className="mt-3 space-y-2" onClick={(e) => e.stopPropagation()}>
              <Textarea
                placeholder="Why do you want to join this event? (Optional)"
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                className="h-24"
                onClick={(e) => e.stopPropagation()}
              />
              <div className="flex justify-end space-x-2">
                <Button 
                  variant="outline" 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setShowRequestForm(false)
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleRequestSubmit()
                  }} 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Submitting..." : "Submit Request"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-3 pt-4 border-t bg-muted/20">
        {(!isParticipant && !isRegistrationClosed && !eventData.event.locked) ||
         (!isParticipant && (isRegistrationClosed ?? eventData.event.locked)) ? (
          <div className="flex gap-3 w-full">
            {!isParticipant && !isRegistrationClosed && !eventData.event.locked && (
              <>
                {eventData.event.requiresApproval ? (
                  registrationStatus?.status === "pending" ? (
                    <Link href={`/events/${eventData.event.id}/status`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" className="hover:bg-yellow-500 hover:text-white">
                        View Status
                      </Button>
                    </Link>
                  ) : registrationStatus?.status === "rejected" ? (
                    <Link href={`/events/${eventData.event.id}/status`} onClick={(e) => e.stopPropagation()}>
                      <Button variant="outline" className="hover:bg-red-500 hover:text-white">
                        View Status
                      </Button>
                    </Link>
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleJoinClick()
                      }}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                    >
                      Request to Join
                    </Button>
                  )
                ) : (
                  <Button
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleJoinClick()
                    }}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-200"
                  >
                    Join
                  </Button>
                )}
              </>
            )}

            {!isParticipant && (isRegistrationClosed ?? eventData.event.locked) && (
              <Button disabled className="opacity-50" title="Registration is closed">
                Closed
              </Button>
            )}
          </div>
        ) : null}

        {/* Additional event info for completed events */}
        {status === "past" && (
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            <span>Event completed on {endDate.toLocaleDateString()}</span>
          </div>
        )}
      </CardFooter>
    </Card>
    </Link>
  )
}

