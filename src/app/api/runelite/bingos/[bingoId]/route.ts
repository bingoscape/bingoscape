import { type NextRequest, NextResponse } from "next/server"
import { validateApiKey } from "@/lib/api-auth"
import { db } from "@/server/db"
import { bingos, teamMembers } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { formatBingoData } from "@/lib/bingo-formatter"

export async function GET(request: NextRequest, { params }: { params: { bingoId: string } }) {
  try {
    // Validate API key
    const userId = await validateApiKey(request)
    if (!userId) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const bingoId = params.bingoId

    console.log("bingoId", bingoId)
    // Get the bingo data
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })

    if (!bingo) {
      return NextResponse.json({ error: "Bingo not found" }, { status: 404 })
    }

    const userTeam = await db.query.teams.findFirst({
      where: (teams, { exists, and, eq }) =>
        and(
          eq(teams.eventId, bingo.eventId),
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

    // Format the response using shared utility
    const formattedBingo = await formatBingoData(bingo, userTeam ?? null)


    return NextResponse.json(formattedBingo)
  } catch (error) {
    console.error("Error fetching bingo data:", error)
    return NextResponse.json({ error: "An error occurred while fetching bingo data" }, { status: 500 })
  }
}
