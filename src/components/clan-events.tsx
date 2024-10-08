'use client'

import { useState } from "react";
import { EventCard } from "@/components/event-card";
import { joinEvent, type EventData, type EventParticipant } from "@/app/actions/events";
import { toast } from "@/hooks/use-toast";
import { useSession } from "next-auth/react";

interface ClanEventsClientProps {
  initialEvents: EventData[];
  clanId: string;
}

export default function ClanEventsClient({ initialEvents, clanId }: ClanEventsClientProps) {
  const [clanEvents, setClanEvents] = useState<EventData[]>(initialEvents);
  const { data: session } = useSession();

  const handleJoinEvent = async (eventId: string) => {
    if (!session?.user?.id) {
      toast({
        title: "Error",
        description: "You must be logged in to join an event.",
        variant: "destructive",
      });
      return;
    }

    try {
      await joinEvent(eventId);
      setClanEvents(prevEvents =>
        prevEvents.map(eventData =>
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
                    role: 'participant',
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  } as EventParticipant
                ]
              }
            }
            : eventData
        )
      );
      toast({
        title: "Success",
        description: "You have successfully joined the event.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to join the event.",
        variant: "destructive",
      });
    }
  };

  const isParticipant = (eventData: EventData) => {
    return eventData.event.eventParticipants?.some(participant => participant.userId === session?.user?.id);
  };

  const categorizeEvents = (events: EventData[]) => {
    const now = new Date();
    return events.reduce((acc, eventData) => {
      const startDate = new Date(eventData.event.startDate);
      const endDate = new Date(eventData.event.endDate);
      if (now >= startDate && now <= endDate) {
        acc.running.push(eventData);
      } else if (now < startDate) {
        acc.upcoming.push(eventData);
      } else {
        acc.past.push(eventData);
      }
      return acc;
    }, { running: [], upcoming: [], past: [] } as { running: EventData[], upcoming: EventData[], past: EventData[] });
  };

  const { running, upcoming, past } = categorizeEvents(clanEvents);

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
                {running.map(eventData => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
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
                {upcoming.map(eventData => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
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
                {past.map(eventData => (
                  <EventCard
                    key={eventData.event.id}
                    eventData={eventData}
                    onJoin={() => handleJoinEvent(eventData.event.id)}
                    isParticipant={isParticipant(eventData) ?? false}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
