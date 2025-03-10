import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/server/db"
import { events, bingos, tiles, eventParticipants } from "@/server/db/schema"
import { eq, asc, and } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"

export async function GET(request: NextRequest, { params }: { params: { eventId: string } }) {
  try {
    // Validate API key
    const userId = await validateApiKey(request)
    if (!userId) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const { eventId } = params

    if (!eventId) {
      return NextResponse.json({ error: "Event ID is required" }, { status: 400 })
    }

    // Check if the user is a participant in the event
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.userId, userId)),
    })

    // If the event is not public, check if the user is a participant
    const event = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })

    if (!event) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // If the event is not public and the user is not a participant, deny access
    if (!event.public && !participant) {
      return NextResponse.json({ error: "You do not have access to this event" }, { status: 403 })
    }

    // Fetch the event with all related bingos and tiles, filtering for visible bingos
    const eventWithBingos = await db.query.events.findFirst({
      where: eq(events.id, eventId),
      with: {
        bingos: {
          where: eq(bingos.visible, true), // Only include visible bingos
          orderBy: [asc(bingos.createdAt)],
          with: {
            tiles: {
              orderBy: [asc(tiles.index)],
            },
          },
        },
      },
    })

    if (!eventWithBingos) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 })
    }

    // Return the event data with visible bingos and tiles
    return NextResponse.json({
      event: {
        id: eventWithBingos.id,
        title: eventWithBingos.title,
        description: eventWithBingos.description,
        startDate: eventWithBingos.startDate,
        endDate: eventWithBingos.endDate,
        locked: eventWithBingos.locked,
        public: eventWithBingos.public,
        bingos: eventWithBingos.bingos.map((bingo) => ({
          id: bingo.id,
          title: bingo.title,
          description: bingo.description,
          rows: bingo.rows,
          columns: bingo.columns,
          codephrase: bingo.codephrase,
          locked: bingo.locked,
          visible: bingo.visible,
          tiles: bingo.tiles.map((tile) => ({
            id: tile.id,
            title: tile.title,
            description: tile.description,
            headerImage: tile.headerImage,
            weight: tile.weight,
            index: tile.index,
            isHidden: tile.isHidden,
          })),
        })),
      },
    })
  } catch (error) {
    console.error("Error fetching event data:", error)
    return NextResponse.json({ error: "Failed to fetch event data" }, { status: 500 })
  }
}

