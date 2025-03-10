import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, bingos, eventParticipants } from "@/server/db/schema"
import { eq, and, asc } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"

// Get all tiles for a specific bingo
export async function GET(req: Request, { params }: { params: { bingoId: string } }) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  const { bingoId } = params

  try {
    // Get the bingo to check event access
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })

    if (!bingo) {
      return NextResponse.json({ error: "Bingo not found" }, { status: 404 })
    }

    // Check if user is a participant in this event
    const participant = await db.query.eventParticipants.findFirst({
      where: and(eq(eventParticipants.eventId, bingo.eventId), eq(eventParticipants.userId, userId)),
    })

    if (!participant) {
      return NextResponse.json({ error: "Not a participant in this event" }, { status: 403 })
    }

    // Get all tiles for this bingo
    const bingoTiles = await db.select().from(tiles).where(eq(tiles.bingoId, bingoId)).orderBy(asc(tiles.index))

    return NextResponse.json(bingoTiles)
  } catch (error) {
    console.error("Error fetching tiles:", error)
    return NextResponse.json({ error: "Failed to fetch tiles" }, { status: 500 })
  }
}

