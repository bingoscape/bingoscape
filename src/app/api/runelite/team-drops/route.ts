import { NextResponse } from "next/server"
import { logger } from "@/lib/logger"
import { validateApiKey } from "@/lib/api-auth"
import { teamDropsRateLimiter } from "@/lib/rate-limit"
import {
  POLL_INTERVAL_MS,
  clampLimit,
  decodeCursor,
  encodeCursor,
  fetchTeamDrops,
  getCallerTeamIds,
  getHeadCursor,
  isCursorStale,
  isUuid,
} from "@/lib/team-drops"

function respond(body: {
  cursor: string
  hasMore?: boolean
  resync?: boolean
  drops?: unknown[]
}) {
  return NextResponse.json({
    hasMore: false,
    resync: false,
    pollIntervalMs: POLL_INTERVAL_MS,
    drops: [],
    ...body,
  })
}

// Poll feed of drops submitted by the caller's teammates
export async function GET(req: Request) {
  const userId = await validateApiKey(req)
  if (!userId) {
    return NextResponse.json({ error: "Invalid API key" }, { status: 401 })
  }

  const rate = teamDropsRateLimiter(userId)
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

    const { drops, hasMore } = await fetchTeamDrops({
      userId,
      teamIds,
      after: cursor,
      limit,
    })

    const last = drops[drops.length - 1]
    return respond({
      cursor: last ? encodeCursor({ t: last.createdAt, id: last.id }) : since,
      hasMore,
      drops,
    })
  } catch (error) {
    logger.error({ error }, "Error fetching team drops:", error)
    return NextResponse.json(
      { error: "Failed to fetch team drops" },
      { status: 500 }
    )
  }
}
