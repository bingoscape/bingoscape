"use client"

import { useState, useEffect } from "react"
import { EventCard } from "@/components/event-card"
import { joinEvent, type EventData, type EventParticipant, getUserRegistrationStatus } from "@/app/actions/events"
import { toast } from "@/hooks/use-toast"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

interface ClanEventsClientProps {
  initialEvents: EventData[]
  clanId: string
}

export default function ClanEventsClient({ initialEvents, clanId }: ClanEventsClientProps) {
  const [clanEvents, setClanEvents] = useState<EventData[]>(initialEvents)
  const [registrationStatuses, setRegistrationStatuses] = useState<
    Record<
      string,
      {
        status: "not_requested" | "pending" | "approved" | "rejected"
        message?: string
        responseMessage?: string
      }
    >
  >({})
  const { data: session } = useSession()
  const router = useRouter()

  // Fetch registration statuses for all events
  useEffect(() => {
    if (!session?.user?.id) return

    const fetchRegistrationStatuses = async () => {
      const statuses: Record<string, {
        status: "not_requested" | "pending" | "approved" | "rejected"
        message?: string
        responseMessage?: string
      }> = {}

      for (const eventData of clanEvents) {
        try {
          const status = await getUserRegistrationStatus(eventData.event.id)
          statuses[eventData.event.id] = status
        } catch (error) {
          console.error(`Error fetching registration status for event ${eventData.event.id}:`, error)
        }
      }

      setRegistrationStatuses(statuses)
    }

    fetchRegistrationStatuses()
      .then(() => console.log("Fetched registration statuses"))
      .catch((error) => console.error("Failed to fetch registration statuses:", error))
  }, [clanEvents, session?.user?.id])

  const handleJoinEvent = async (eventId: string) => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to join an event.",
        variant: "destructive",
      })
      return
    }

    try {
      // Check if the user already has a registration status
      const currentStatus = registrationStatuses[eventId]

      if (currentStatus) {
        if (currentStatus.status === "approved") {
          // If already approved, redirect to event page
          router.push(`/events/${eventId}`)
          return
        } else if (currentStatus.status === "pending" || currentStatus.status === "rejected") {
          // If pending or rejected, redirect to status page
          router.push(`/events/${eventId}/status`)
          return
        }
      }

      // Otherwise, join the event
      await joinEvent(eventId)

      // Update the local state
      setClanEvents((prevEvents) =>
        prevEvents.map((eventData) =>
          eventData.event.id === eventId
            ? {
              ...eventData,
              event: {
                ...eventData.event,
                eventParticipants: [
                  ...(eventData.event.eventParticipants ?? []),
                  {
                    eventId: eventId,
                    userId: session.user.id,
                    role: "participant",
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as EventParticipant,
                ],
              },
            }
            : eventData,
        ),
      )

      toast({
        title: "Success",
        description: "You have successfully joined the event.",
      })

      // Redirect to the event page
      router.push(`/events/${eventId}`)
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join the event.",
        variant: "destructive",
      })
    }
  }

  const isParticipant = (eventData: EventData) => {
    return eventData.event.eventParticipants?.some((participant) => participant.userId === session?.user?.id)
  }

  const categorizeEvents = (events: EventData[]) => {
    const now = new Date()
    return events.reduce(
      (acc, eventData) => {
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
      },
      { running: [], upcoming: [], past: [] } as { running: EventData[]; upcoming: EventData[]; past: EventData[] },
    )
  }

  const { running, upcoming, past } = categorizeEvents(clanEvents)

  return (
    <div className="space-y-10">
      {clanEvents.length === 0 ? (
        <p className="text-muted-foreground">No events have been created for this clan yet.</p>
      ) : (
        <>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Running Events</h2>
            {running.length === 0 ? (
              <p className="text-muted-foreground">No events are currently running.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {running.map((eventData) => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
                    registrationStatus={registrationStatuses[eventData.event.id]}
                  />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Upcoming Events</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">No upcoming events.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcoming.map((eventData) => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
                    registrationStatus={registrationStatuses[eventData.event.id]}
                  />
                ))}
              </div>
            )}
          </section>
          <section>
            <h2 className="text-2xl font-semibold mb-4">Past Events</h2>
            {past.length === 0 ? (
              <p className="text-muted-foreground">No past events.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {past.map((eventData) => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
                    registrationStatus={registrationStatuses[eventData.event.id]}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

