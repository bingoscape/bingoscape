import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { tiles, teamTileSubmissions, bingos } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { validateApiKey } from "@/lib/api-auth"
import { getTeamForUserInEvent } from "@/lib/team-utils"

export async function GET(req: Request, { params }: { params: { bingoId: string } }) {
  // Validate API key from Authorization header
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  try {
    const { bingoId } = params

    // Get the bingo to find its event
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })

    if (!bingo) {
      return NextResponse.json({ error: "Bingo not found" }, { status: 404 })
    }

    // Get the team for this user in the event
    const team = await getTeamForUserInEvent(userId, bingo.eventId)

    if (!team) {
      return NextResponse.json({ error: "User is not part of any team in this event" }, { status: 404 })
    }

    // Get all tiles for the bingo
    const bingoTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingoId),
      orderBy: tiles.index,
    })

    // Get all submissions for the team
    const submissions = await db.query.teamTileSubmissions.findMany({
      where: eq(teamTileSubmissions.teamId, team.id),
    })

    // Create a map of tile IDs to submission status
    const tileStatusMap: Record<
      string,
      {
        id: string
        status: "pending" | "accepted" | "requires_interaction" | "declined" | "not_submitted"
        index: number
        title: string
      }
    > = {}

    // Initialize with all tiles as "not_submitted"
    bingoTiles.forEach((tile) => {
      tileStatusMap[tile.id] = {
        id: tile.id,
        status: "not_submitted",
        index: tile.index,
        title: tile.title,
      }
    })

    // Update with actual submission status where available
    submissions.forEach((submission) => {
      if (tileStatusMap[submission.tileId]) {
        tileStatusMap[submission.tileId]!.status = submission.status
      }
    })

    return NextResponse.json({
      bingoId,
      teamId: team.id,
      teamName: team.name,
      tiles: tileStatusMap,
    })
  } catch (error) {
    console.error("Error fetching bingo tiles:", error)
    return NextResponse.json({ error: "Failed to fetch bingo tiles" }, { status: 500 })
  }
}

