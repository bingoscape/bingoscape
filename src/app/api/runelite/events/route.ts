import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { teams, teamMembers, eventParticipants, events } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { getEvents } from "@/app/actions/events"

// Get all events for the authenticated user
export async function GET(req: Request) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  try {
    // Get all events where the user is a participant or creator
    //
    //

    const userEvents = await db.query.events.findMany({
      where: (events, { or, eq, exists, and }) =>
        or(
          eq(events.creatorId, userId),
          exists(
            db
              .select()
              .from(eventParticipants)
              .where(and(eq(eventParticipants.eventId, events.id), eq(eventParticipants.userId, userId))),
          ),
        ),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: {
          with: {
            tiles: true
          },
        },
      },
      orderBy: events.createdAt,
    })
    // Get the user's team for each event
    const eventsWithTeams = await Promise.all(
      userEvents.map(async (eventData) => {
        const userTeam = await db.query.teams.findFirst({
          where: eq(teams.eventId, eventData.id),
          with: {
            teamMembers: {
              where: eq(teamMembers.userId, userId),
            },
          },
        })

        return {
          ...eventData,
          userTeam: userTeam
            ? {
              id: userTeam.id,
              name: userTeam.name,
              isLeader: userTeam.teamMembers[0]?.isLeader ?? false,
            }
            : null,
          role: eventData.creatorId === userId ? "admin" : (eventData.eventParticipants ?? []).find(p => p.userId === userId)?.role,
        }
      }),
    )

    return NextResponse.json(eventsWithTeams)
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

