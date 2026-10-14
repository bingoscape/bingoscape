"use client"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PrizePoolDisplay } from "./prize-pool-display"
import { GameTypeBadge } from "./game-type-badge"
import { MiniBoard } from "./mini-board"
import { EventData } from "@/app/actions/events"
import {
  Clock,
  Users,
  CalendarIcon,
  Trophy,
  CheckCircle2,
  XCircle,
  Clock3,
  AlertTriangle,
  Star,
  Settings,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"
import { requestToJoinEvent } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { EventTimeDisplay } from "./event-time-display"

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

export function EventCard({
  eventData,
  onJoin,
  isParticipant,
  status,
  registrationStatus,
}: EventCardProps) {
  const startDate = new Date(eventData.event.startDate)
  const endDate = new Date(eventData.event.endDate)
  const registrationDeadline = eventData.event.registrationDeadline
    ? new Date(eventData.event.registrationDeadline)
    : null

  const eventTz = eventData.event.timezone || "UTC"
  
  const isRegistrationClosed =
    !!registrationDeadline && new Date() > registrationDeadline
  const [showRequestForm, setShowRequestForm] = useState(false)
  const [requestMessage, setRequestMessage] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  const handleRequestSubmit = async () => {
    setIsSubmitting(true)
    try {
      const result = await requestToJoinEvent(
        eventData.event.id,
        requestMessage
      )
      if (!result.success) throw new Error(result.error)
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
        description:
          error instanceof Error ? error.message : "Failed to submit request",
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
            description:
              error instanceof Error ? error.message : "Failed to join event",
            variant: "destructive",
          })
        }
      }
    }
  }

  const renderRegistrationStatus = () => {
    if (!registrationStatus || registrationStatus.status === "not_requested")
      return null

    switch (registrationStatus.status) {
      case "pending":
        return (
          <div className="mt-2 flex items-center text-pending">
            <Clock3 aria-hidden="true" className="mr-1 h-4 w-4" />
            <span className="text-sm">Registration pending approval</span>
          </div>
        )
      case "approved":
        return (
          <div className="mt-2 flex items-center text-success">
            <CheckCircle2 aria-hidden="true" className="mr-1 h-4 w-4" />
            <span className="text-sm">Registration approved</span>
          </div>
        )
      case "rejected":
        return (
          <div className="mt-2 flex items-center text-danger">
            <XCircle aria-hidden="true" className="mr-1 h-4 w-4" />
            <span className="text-sm">Registration rejected</span>
            {registrationStatus.responseMessage && (
              <div className="mt-1 text-xs text-muted-foreground">
                Reason: {registrationStatus.responseMessage}
              </div>
            )}
          </div>
        )
    }
  }

  return (
    // The title is a real link stretched over the whole card (after:inset-0), so
    // the card is keyboard-focusable, middle-clickable and long-pressable.
    // Nested interactive elements sit above it with `relative z-10`.
    <Card
      className={cn(
        "group relative flex h-full flex-col overflow-hidden rounded-sm transition-colors hover:brightness-110 has-focus-visible:ring-2 has-focus-visible:ring-ring",
        status === "active" && "border-l-4 border-l-success"
      )}
    >
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left/Top Column: Info & Metadata */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div>
            {/* Prize pool display */}
            {eventData.totalPrizePool > 0 && (
              <div className="absolute left-4 top-4 z-10">
                <PrizePoolDisplay
                  prizePool={eventData.totalPrizePool}
                  variant="badge"
                />
              </div>
            )}

            <CardHeader className="pb-3 pt-6">
              <div className="flex flex-col space-y-2">
                <div
                  className={`${eventData.totalPrizePool > 0 ? "mt-6" : ""}`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-xl font-bold tracking-tight">
                      <Link
                        href={`/events/${eventData.event.id}`}
                        className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-hidden"
                      >
                        {eventData.event.title}
                      </Link>
                    </CardTitle>
                    <GameTypeBadge gameType={eventData.event.gameType} />
                    {eventData.event.role === "admin" && (
                      <Badge variant="info">
                        Admin
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex items-start">
                      <CalendarIcon
                        aria-hidden="true"
                        className="mr-2.5 mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                      />
                      <div className="flex w-full flex-col">
                        <EventTimeDisplay
                          date={startDate}
                          label="Start"
                          eventTz={eventTz}
                        />
                        <EventTimeDisplay
                          date={endDate}
                          label="End"
                          eventTz={eventTz}
                        />
                      </div>
                    </div>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </div>
          <CardContent className="flex-1 pb-4">
            <div className="space-y-4">
              {eventData.event.description && (
                <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                  {eventData.event.description}
                </p>
              )}

              {/* Event metadata in a structured grid */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {eventData.event.clan && (
                  <div className="osrs-slot flex items-center space-x-2 rounded-sm px-3 py-1.5">
                    <Users aria-hidden="true" className="h-4 w-4 text-primary" />
                    <span className="truncate text-sm font-medium">
                      {eventData.event.clan?.name}
                    </span>
                  </div>
                )}

                <div className="osrs-slot flex items-center space-x-2 rounded-sm px-3 py-1.5">
                  <Trophy aria-hidden="true" className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">
                    {eventData.event.bingos?.length ?? 0}{" "}
                    {(eventData.event.bingos?.length ?? 0) === 1
                      ? "Board"
                      : "Boards"}
                  </span>
                </div>

                {registrationDeadline && (
                  <div className="osrs-slot col-span-full flex items-center space-x-2 rounded-sm p-2">
                    <Clock aria-hidden="true" className="h-4 w-4 text-info" />
                    <span className="text-sm font-medium">
                      Registration:{" "}
                      {registrationDeadline.toLocaleDateString("en-US")}
                    </span>
                    {isRegistrationClosed && (
                      <span className="ml-1 font-semibold text-danger">
                        (Closed)
                      </span>
                    )}
                  </div>
                )}

                {eventData.managerData &&
                  (eventData.managerData.actionItems.pendingRegistrations > 0 ||
                    eventData.managerData.actionItems.pendingSubmissions >
                      0) && (
                    <ul
                      aria-label="Needs your attention"
                      className="col-span-full flex flex-wrap gap-2"
                    >
                      {eventData.managerData.actionItems.pendingRegistrations >
                        0 && (
                        <li className="osrs-slot flex items-center gap-2 rounded-sm border-l-4 border-l-pending px-3 py-1.5 text-sm font-medium">
                          <Users
                            aria-hidden="true"
                            className="h-4 w-4 text-pending"
                          />
                          {
                            eventData.managerData.actionItems
                              .pendingRegistrations
                          }{" "}
                          join request(s)
                        </li>
                      )}
                      {eventData.managerData.actionItems.pendingSubmissions >
                        0 && (
                        <li className="osrs-slot flex items-center gap-2 rounded-sm border-l-4 border-l-pending px-3 py-1.5 text-sm font-medium">
                          <CheckCircle2
                            aria-hidden="true"
                            className="h-4 w-4 text-pending"
                          />
                          {
                            eventData.managerData.actionItems
                              .pendingSubmissions
                          }{" "}
                          submission(s) to review
                        </li>
                      )}
                    </ul>
                  )}

                {eventData.participantData &&
                  eventData.participantData.team && (
                    <div className="osrs-slot col-span-full mt-2 rounded-sm p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Star aria-hidden="true" className="h-4 w-4 text-primary" />
                          {eventData.participantData.team.name}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {eventData.participantData.team.memberCount} members
                        </Badge>
                      </div>
                      {eventData.participantData.progress && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="osrs-panel-inset h-3 flex-1 overflow-hidden rounded-sm">
                            <div
                              className="h-full bg-success"
                              style={{
                                width: `${Math.min(100, Math.max(0, (eventData.participantData.progress.completedTiles / Math.max(1, eventData.participantData.progress.totalTiles)) * 100))}%`,
                              }}
                            />
                          </div>
                          <span className="whitespace-nowrap">
                            {eventData.participantData.progress.completedTiles}{" "}
                            / {eventData.participantData.progress.totalTiles}{" "}
                            tiles
                          </span>
                        </div>
                      )}
                    </div>
                  )}
              </div>

              {eventData.event.requiresApproval && !isParticipant && (
                <div className="osrs-slot flex items-center space-x-2 rounded-sm border-l-4 border-l-warning p-2">
                  <AlertTriangle aria-hidden="true" className="h-4 w-4 text-warning" />
                  <span className="text-sm font-medium">
                    Requires approval to join
                  </span>
                </div>
              )}

              {renderRegistrationStatus()}

              {showRequestForm && (
                <div className="relative z-10 mt-3 space-y-2">
                  <Textarea
                    placeholder="Why do you want to join this event? (Optional)"
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    className="h-24"
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
                        void handleRequestSubmit()
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
        </div>

        {/* Right/Bottom Column: Mini Board */}
        {status !== "past" &&
          eventData.event.bingos &&
          eventData.event.bingos.length > 0 &&
          eventData.event.bingos[0] && (
            <div className="flex w-full shrink-0 items-center justify-center p-4 pt-0 sm:p-6 lg:w-72 lg:pl-0 lg:pt-6">
              <div className="osrs-bevel-inset w-[65%] max-w-[20rem] rounded-sm p-1 opacity-90 transition-opacity group-hover:opacity-100 sm:w-[80%] lg:w-full">
                <MiniBoard
                  bingoId={eventData.event.bingos[0].id}
                  rows={eventData.event.bingos[0].rows}
                  columns={eventData.event.bingos[0].columns}
                  visible={eventData.event.bingos[0].visible}
                />
              </div>
            </div>
          )}
      </div>
      <CardFooter className="flex flex-col gap-3 border-t pt-4">
        {eventData.event.role === "admin" ? (
          <div className="relative z-10 flex w-full gap-3">
            <Button variant="secondary" className="w-full gap-2" asChild>
              <Link href={`/events/${eventData.event.id}/admin`}>
                <Settings aria-hidden="true" className="h-4 w-4" />
                Manage Event
              </Link>
            </Button>
          </div>
        ) : (!isParticipant &&
            !isRegistrationClosed &&
            !eventData.event.locked) ||
          (!isParticipant &&
            (isRegistrationClosed ?? eventData.event.locked)) ? (
          <div className="relative z-10 flex w-full gap-3">
            {!isRegistrationClosed &&
              !eventData.event.locked && (
                <>
                  {eventData.event.requiresApproval ? (
                    registrationStatus?.status === "pending" ? (
                      <Button variant="outline" asChild>
                        <Link href={`/events/${eventData.event.id}/status`}>
                          View Status
                        </Link>
                      </Button>
                    ) : registrationStatus?.status === "rejected" ? (
                      <Button variant="outline" asChild>
                        <Link href={`/events/${eventData.event.id}/status`}>
                          View Status
                        </Link>
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void handleJoinClick()
                        }}
                      >
                        Request to Join
                      </Button>
                    )
                  ) : (
                    <Button
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        void handleJoinClick()
                      }}
                    >
                      Join
                    </Button>
                  )}
                </>
              )}

            {(isRegistrationClosed ?? eventData.event.locked) && (
                <Button
                  disabled
                  className="opacity-50"
                  title="Registration is closed"
                >
                  Closed
                </Button>
              )}
          </div>
        ) : null}

        {/* Additional event info for completed events */}
        {status === "past" && (
          <div className="flex items-center justify-center text-xs text-muted-foreground">
            <CheckCircle2 aria-hidden="true" className="mr-1 h-3 w-3" />
            <span>
              Event completed on {endDate.toLocaleDateString("en-US")}
            </span>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
