import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { validateApiKey } from "@/lib/api-auth"
import { teamTileCompletionsRateLimiter } from "@/lib/rate-limit"
import {
  POLL_INTERVAL_MS,
  clampLimit,
  decodeCursor,
  encodeCursor,
  getCallerTeamIds,
  getHeadCursor,
  isCursorStale,
  isUuid,
} from "@/lib/team-drops"
import { fetchTeamTileCompletions } from "@/lib/team-tile-completions"

function respond(body: {
  cursor: string
  hasMore?: boolean
  resync?: boolean
  completions?: unknown[]
}) {
  return NextResponse.json({
    hasMore: false,
    resync: false,
    pollIntervalMs: POLL_INTERVAL_MS,
    completions: [],
    ...body,
  })
}

// Poll feed of tiles completed by the caller's teams (including the caller's own)
export async function GET(req: Request) {
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  const rate = teamTileCompletionsRateLimiter(userId)
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSeconds) },
      }
    )
  }

  const { searchParams } = new URL(req.url)
  const since = searchParams.get("since")
  const eventId = searchParams.get("eventId")
  const limit = clampLimit(searchParams.get("limit"))

  const cursor = since ? decodeCursor(since) : null
  if (since && !cursor) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
  }

  try {
    // No cursor: hand out the head cursor, no backfill
    if (!cursor || !since) {
      return respond({ cursor: await getHeadCursor() })
    }

    if (await isCursorStale(cursor)) {
      return respond({ cursor: await getHeadCursor(), resync: true })
    }

    // A malformed eventId matches none of the caller's teams
    const teamIds =
      eventId && !isUuid(eventId) ? [] : await getCallerTeamIds(userId, eventId)

    const { completions, hasMore } = await fetchTeamTileCompletions({
      teamIds,
      after: cursor,
      limit,
    })

    const last = completions[completions.length - 1]
    return respond({
      cursor: last ? encodeCursor({ t: last.completedAt, id: last.id }) : since,
      hasMore,
      completions,
    })
  } catch (error) {
    logger.error({ error }, "Error fetching team tile completions:", error)
    return NextResponse.json(
      { error: "Failed to fetch team tile completions" },
      { status: 500 }
    )
  }
}
