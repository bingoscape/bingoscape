import { NextResponse } from "next/server"

import { computeEtag, ifNoneMatchHits } from "@/lib/etag"
import { logger } from "@/lib/logger"
import { authorizeDraftView } from "@/server/draft/http"
import {
  getDraftStamp,
  loadDraftEventsSince,
  loadDraftSnapshot,
} from "@/server/draft/queries"

export const dynamic = "force-dynamic" // Never cached

const CACHE_CONTROL = "private, no-cache"

/**
 * The state of the Event's draft, for clients that poll (team draft 1/4,
 * #215). The live stream (`../stream`, #216) is the primary transport; this
 * is its fallback and its resync.
 *
 * - `GET .../draft/state` answers `{ draft: <snapshot> }`, or `{ draft: null }`
 *   when the Event has no draft.
 * - `GET .../draft/state?since=<seq>` answers only the log events after `seq`
 *   (`{ draft: { id, status, version }, seq, events }`) for the client reducer.
 * - Both carry an ETag derived from the draft's `version` and last `seq`, and
 *   answer 304 to a matching `If-None-Match` without loading the snapshot, so
 *   the 3 s polling of an idle draft stays cheap.
 *
 * Authorizes itself with `draft:view` (Event members only): `src/proxy.ts` does
 * not protect `/api`. 401 without a session, 404 for an unknown Event, 403 for
 * a signed-in user who is not a member.
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  try {
    const allowed = await authorizeDraftView(id)
    if (!allowed.ok) return allowed.response

    const sinceParam = new URL(request.url).searchParams.get("since")
    let since: number | null = null
    if (sinceParam !== null) {
      since = Number(sinceParam)
      if (!Number.isSafeInteger(since) || since < 0) {
        return NextResponse.json(
          { error: "since must be a non-negative integer" },
          { status: 400 }
        )
      }
    }

    const stamp = await getDraftStamp(id)
    const etag = computeEtag({ stamp, since })
    const headers = { ETag: etag, "Cache-Control": CACHE_CONTROL }
    if (ifNoneMatchHits(request.headers.get("If-None-Match"), etag)) {
      return new NextResponse(null, { status: 304, headers })
    }

    if (!stamp) return NextResponse.json({ draft: null }, { headers })

    if (since !== null) {
      const events = await loadDraftEventsSince(stamp.draftId, since)
      return NextResponse.json(
        {
          draft: {
            id: stamp.draftId,
            status: stamp.status,
            version: stamp.version,
          },
          seq: stamp.seq,
          events,
        },
        { headers }
      )
    }

    const snapshot = await loadDraftSnapshot(id)
    return NextResponse.json({ draft: snapshot }, { headers })
  } catch (error) {
    logger.error({ error, eventId: id }, "Error loading draft state")
    return NextResponse.json(
      { error: "An error occurred while loading the draft" },
      { status: 500 }
    )
  }
}
