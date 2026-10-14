import { type NextRequest, NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { validateApiKey } from "@/lib/api-auth"
import { bingoBoardRateLimiter } from "@/lib/rate-limit"
import { computeEtag, ifNoneMatchHits } from "@/lib/etag"
import { db } from "@/server/db"
import { bingos, teamMembers } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { can } from "@/lib/authz/policy"
import { getApiActor } from "@/server/authz/api"
import { formatBingoData } from "@/lib/bingo-formatter"

// The body depends on the caller (team, manager status) and on the clock, so
// it may be cached per user but must be revalidated on every use.
const CACHE_CONTROL = "private, no-cache"

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ bingoId: string }> }
) {
  const params = await props.params
  try {
    // Validate API key
    const userId = await validateApiKey(request)
    if (!userId) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
    }

    const rate = bingoBoardRateLimiter(userId)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      )
    }

    const bingoId = params.bingoId

    logger.debug({ bingoId }, "Fetching bingo data")
    // Get the bingo data
    const bingo = await db.query.bingos.findFirst({
      where: eq(bingos.id, bingoId),
    })

    // Only the event's participants and managers may read a board, and only
    // managers see hidden ones. Everybody else gets the same 404 an unknown
    // id gets, so the answer does not reveal that a board exists.
    const apiActor = bingo ? await getApiActor(userId, bingo.eventId) : null
    const actor =
      apiActor?.status === "ok" && apiActor.actor.role !== null
        ? apiActor.actor
        : null
    // Draft Boards are for managers (`board:view-secret`).
    if (
      !bingo ||
      !actor ||
      (!bingo.visible && !can(actor, "board:view-secret"))
    ) {
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
              .where(
                and(
                  eq(teamMembers.teamId, teams.id),
                  eq(teamMembers.userId, userId)
                )
              )
          )
        ),
      with: {
        teamMembers: {
          with: {
            user: {
              columns: {
                runescapeName: true,
              },
            },
          },
        },
      },
    })

    // Format the response using shared utility
    const formattedBingo = await formatBingoData(bingo, userTeam ?? null, {
      userId,
    })

    // serverNow changes on every call; leaving it out keeps the ETag stable
    // while nothing else changed.
    const { battleship, ...rest } = formattedBingo
    const etag = computeEtag(
      battleship
        ? { ...rest, battleship: { ...battleship, serverNow: undefined } }
        : rest
    )
    const headers = { ETag: etag, "Cache-Control": CACHE_CONTROL }

    if (ifNoneMatchHits(request.headers.get("If-None-Match"), etag)) {
      return new NextResponse(null, { status: 304, headers })
    }

    return NextResponse.json(formattedBingo, { headers })
  } catch (error) {
    logger.error({ error }, "Error fetching bingo data")
    return NextResponse.json(
      { error: "An error occurred while fetching bingo data" },
      { status: 500 }
    )
  }
}
