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
import type { EventData } from "@/app/actions/events"
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

  const RegistrationStatus = () => {
    if (!registrationStatus || registrationStatus.status === "not_requested")
      return null

    switch (registrationStatus.status) {
      case "pending":
        return (
          <div className="mt-2 flex items-center text-yellow-500">
            <Clock3 className="mr-1 h-4 w-4" />
            <span className="text-sm">Registration pending approval</span>
          </div>
        )
      case "approved":
        return (
          <div className="mt-2 flex items-center text-green-500">
            <CheckCircle2 className="mr-1 h-4 w-4" />
            <span className="text-sm">Registration approved</span>
          </div>
        )
      case "rejected":
        return (
          <div className="mt-2 flex items-center text-red-500">
            <XCircle className="mr-1 h-4 w-4" />
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
    <Card
      onClick={() => router.push(`/events/${eventData.event.id}`)}
      className={cn(
        "group relative flex h-full cursor-pointer flex-col overflow-hidden border border-border/50 bg-card/60 backdrop-blur-xl transition-all duration-500 hover:scale-[1.02] hover:border-primary/50 hover:shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-primary/20",
        status === "past" && "opacity-90 hover:opacity-100",
        status === "active" &&
          "border-green-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]"
      )}
    >
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left/Top Column: Info & Metadata */}
        <div className="flex w-full min-w-0 flex-1 flex-col">
          <div className="relative">
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
                    <CardTitle className="bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-xl font-bold tracking-tight text-transparent">
                      {eventData.event.title}
                    </CardTitle>
                    <GameTypeBadge gameType={eventData.event.gameType} />
                    {eventData.event.role === "admin" && (
                      <Badge
                        variant="outline"
                        className="border-purple-500 bg-purple-500/10 text-purple-500"
                      >
                        Admin
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="mt-3 flex flex-col gap-1 text-sm">
                    <div className="flex items-start">
                      <CalendarIcon className="mr-2.5 mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
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
                  <div className="flex items-center space-x-2 rounded-full border border-border/50 bg-muted/40 px-3 py-1.5 backdrop-blur-sm">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="truncate text-sm font-medium">
                      {eventData.event.clan?.name}
                    </span>
                  </div>
                )}

                <div className="flex items-center space-x-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 backdrop-blur-sm">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    {eventData.event.bingos?.length ?? 0} Bingos boards
                  </span>
                </div>

                {registrationDeadline && (
                  <div className="col-span-full flex items-center space-x-2 rounded-lg bg-muted/50 p-2">
                    <Clock className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">
                      Registration:{" "}
                      {registrationDeadline.toLocaleDateString("en-US")}
                    </span>
                    {isRegistrationClosed && (
                      <span className="ml-1 font-semibold text-destructive">
                        (Closed)
                      </span>
                    )}
                  </div>
                )}

                {eventData.managerData && (
                  <div className="col-span-full mt-2 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Manager Actions
                    </div>
                    <div className="flex flex-col gap-2">
                      {eventData.managerData.actionItems.pendingRegistrations >
                        0 && (
                        <div className="flex items-center space-x-2 rounded-lg border border-blue-200 bg-blue-50 p-2 dark:border-blue-800 dark:bg-blue-900/20">
                          <Users className="h-4 w-4 text-blue-500" />
                          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                            {
                              eventData.managerData.actionItems
                                .pendingRegistrations
                            }{" "}
                            pending join request(s)
                          </span>
                        </div>
                      )}
                      {eventData.managerData.actionItems.pendingSubmissions >
                        0 && (
                        <div className="flex items-center space-x-2 rounded-lg border border-purple-200 bg-purple-50 p-2 dark:border-purple-800 dark:bg-purple-900/20">
                          <CheckCircle2 className="h-4 w-4 text-purple-500" />
                          <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                            {
                              eventData.managerData.actionItems
                                .pendingSubmissions
                            }{" "}
                            pending submission(s)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {eventData.participantData &&
                  eventData.participantData.team && (
                    <div className="col-span-full mt-2 rounded-lg border border-border/50 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Star className="h-4 w-4 text-yellow-500" />
                          {eventData.participantData.team.name}
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {eventData.participantData.team.memberCount} members
                        </Badge>
                      </div>
                      {eventData.participantData.progress && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                            <div
                              className="h-full bg-primary"
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
                <div className="flex items-center space-x-2 rounded-lg border border-amber-200 bg-amber-50 p-2 dark:border-amber-800 dark:bg-amber-900/20">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    Requires approval to join
                  </span>
                </div>
              )}

              <RegistrationStatus />

              {showRequestForm && (
                <div
                  className="mt-3 space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
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
        {eventData.event.bingos &&
          eventData.event.bingos.length > 0 &&
          eventData.event.bingos[0] && (
            <div className="flex w-full shrink-0 items-center justify-center p-4 pt-0 sm:p-6 lg:w-72 lg:pl-0 lg:pt-6">
              <div className="w-[80%] max-w-[20rem] opacity-90 drop-shadow-xl transition-all duration-500 group-hover:scale-105 group-hover:opacity-100 lg:w-full">
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
      <CardFooter className="flex flex-col gap-3 border-t bg-muted/20 pt-4">
        {eventData.event.role === "admin" ? (
          <div className="flex w-full gap-3">
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                router.push(`/events/${eventData.event.id}/admin`)
              }}
            >
              <Settings className="h-4 w-4" />
              Manage Event
            </Button>
          </div>
        ) : (!isParticipant &&
            !isRegistrationClosed &&
            !eventData.event.locked) ||
          (!isParticipant &&
            (isRegistrationClosed ?? eventData.event.locked)) ? (
          <div className="flex w-full gap-3">
            {!isRegistrationClosed &&
              !eventData.event.locked && (
                <>
                  {eventData.event.requiresApproval ? (
                    registrationStatus?.status === "pending" ? (
                      <Button
                        variant="outline"
                        className="hover:bg-yellow-500 hover:text-white"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          router.push(`/events/${eventData.event.id}/status`)
                        }}
                      >
                        View Status
                      </Button>
                    ) : registrationStatus?.status === "rejected" ? (
                      <Button
                        variant="outline"
                        className="hover:bg-red-500 hover:text-white"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          router.push(`/events/${eventData.event.id}/status`)
                        }}
                      >
                        View Status
                      </Button>
                    ) : (
                      <Button
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          void handleJoinClick()
                        }}
                        className="bg-primary text-primary-foreground shadow-md duration-200 hover:bg-primary/90 hover:shadow-lg"
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
                      className="bg-primary text-primary-foreground shadow-md duration-200 hover:bg-primary/90 hover:shadow-lg"
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
            <CheckCircle2 className="mr-1 h-3 w-3" />
            <span>
              Event completed on {endDate.toLocaleDateString("en-US")}
            </span>
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
