import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { settleExpiredDraft } from "@/server/draft/expire"
import { authorizeDraftView, parseSeq } from "@/server/draft/http"
import { getDraftStamp } from "@/server/draft/queries"
import { openDraftStream } from "@/server/draft/stream"
import { checkRateLimit, rateLimitedResponse } from "@/server/rate-limit"

// Long-lived streaming response: needs the Node runtime, never cached.
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * The live feed of the Event's draft (team draft 2/4, #216), as Server-Sent
 * Events: `draft` (one log event, `id` = its `seq`), `reset` (a full snapshot
 * when the client is too far behind) and `bye` (the server closes the stream;
 * reconnect). See `src/server/draft/stream.ts` for the protocol.
 *
 * - Position: the `Last-Event-ID` header (what the browser sends on its own
 *   reconnects) wins over `?since=<seq>` (the first connect, with the `seq` of
 *   the rendered snapshot). Neither: the client gets a `reset` snapshot.
 * - Authorizes itself with `draft:view` (Event members only): `src/proxy.ts`
 *   does not protect `/api`. 401 / 403 / 404 as the state endpoint; 404 also
 *   when the Event has no draft. Rate limited (`draftStream`), and one user
 *   may hold 3 streams (429 beyond that).
 * - Every stream ends after about 5 minutes (`bye` with reason `cap`) so the
 *   client reconnects and is authorized again.
 *
 * Needs a reverse proxy that does not buffer (docs/PRODUCTION-SETUP.md).
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  try {
    const allowed = await authorizeDraftView(id)
    if (!allowed.ok) return allowed.response

    const limited = await checkRateLimit("draftStream", allowed.userId)
    if (!limited.allowed) return rateLimitedResponse(limited)

    const sinceParam = new URL(request.url).searchParams.get("since")
    if (sinceParam !== null && parseSeq(sinceParam) === null) {
      return NextResponse.json(
        { error: "since must be a non-negative integer" },
        { status: 400 }
      )
    }
    const since =
      parseSeq(request.headers.get("Last-Event-ID")) ?? parseSeq(sinceParam)

    // Lazy enforcement of the pick timer: connecting resolves an expired turn.
    await settleExpiredDraft(id)
    const stamp = await getDraftStamp(id)
    if (!stamp) {
      return NextResponse.json(
        { error: "This event has no draft" },
        { status: 404 }
      )
    }

    const stream = await openDraftStream({
      eventId: id,
      draftId: stamp.draftId,
      userId: allowed.userId,
      since,
      currentSeq: stamp.seq,
      signal: request.signal,
    })
    if (stream === "limit") {
      return NextResponse.json(
        { error: "Too many open draft streams", code: "STREAM_LIMIT" },
        { status: 429, headers: { "Retry-After": "10" } }
      )
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        // no-transform keeps compression middleware from buffering the stream.
        "Cache-Control": "no-cache, no-transform",
        // nginx: do not buffer this response.
        "X-Accel-Buffering": "no",
      },
    })
  } catch (error) {
    logger.error({ error, eventId: id }, "Error opening the draft stream")
    return NextResponse.json(
      { error: "An error occurred while opening the draft stream" },
      { status: 500 }
    )
  }
}
