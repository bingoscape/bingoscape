import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { eventParticipants, events, teamMembers, bingos } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { formatBingoData } from "@/lib/bingo-formatter"

// Get all events for the authenticated user
export async function GET(req: Request) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  try {
    // Get all events where the user is a participant or creator
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
          where: (bingos, { eq, and }) => and(eq(bingos.visible, true), eq(bingos.bingoType, "standard")),
        },
      },
      orderBy: events.createdAt,
    })

    // Get the user's team for each event
    const eventsWithTeams = await Promise.all(
      userEvents.map(async (eventData) => {
        // Find the user's team in this event
        const userTeam = await db.query.teams.findFirst({
          where: (teams, { exists, and, eq }) =>
            and(
              eq(teams.eventId, eventData.id),
              exists(
                db
                  .select()
                  .from(teamMembers)
                  .where(and(eq(teamMembers.teamId, teams.id), eq(teamMembers.userId, userId)))
              )
            ),
          with: {
            teamMembers: {
              with: {
                user: {
                  columns: {
                    runescapeName: true,
                  }
                }
              }
            },
          },
        })

        // Process each bingo to get the correct tiles and data
        const processedBingos = await Promise.all(
          eventData.bingos.map(async (bingo) => {
            return await formatBingoData(bingo, userTeam ?? null)
          })
        )

        return {
          id: eventData.id,
          title: eventData.title,
          description: eventData.description,
          startDate: eventData.startDate,
          endDate: eventData.endDate,
          createdAt: eventData.createdAt,
          updatedAt: eventData.updatedAt,
          locked: eventData.locked,
          public: eventData.public,
          basePrizePool: eventData.basePrizePool,
          minimumBuyIn: eventData.minimumBuyIn,
          clan: eventData.clan,
          role: eventData.creatorId === userId ? "admin" : (eventData.eventParticipants[0]?.role ?? "participant"),
          userTeam: !!userTeam ? {
            name: userTeam.name,
            members: userTeam.teamMembers.map((member) => ({
              isLeader: member.isLeader,
              runescapeName: member.user.runescapeName,
            }))
          } : null,
          bingos: processedBingos,
        }
      }),
    )

    return NextResponse.json(eventsWithTeams.filter((event) => event.bingos.length > 0))
  } catch (error) {
    console.error("Error fetching events:", error)
    return NextResponse.json({ error: "Failed to fetch events" }, { status: 500 })
  }
}

