import { ImageResponse } from "next/og"
import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"

import { buildRecapImage } from "@/components/draft/recap/recap-image-element"
import { logger } from "@/lib/logger"
import { db } from "@/server/db"
import { events } from "@/server/db/schema"
import { authorizeDraftView } from "@/server/draft/http"
import { loadDraftSnapshot } from "@/server/draft/queries"
import { checkRateLimit, rateLimitedResponse } from "@/server/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic" // Never cached

/**
 * The final rosters of the Event's finished draft as a PNG, for "Share as
 * image" (team draft 4/4, #218), e.g. to paste into Discord.
 *
 * - `GET .../draft/recap-image` answers the image; `?download=1` adds a
 *   `Content-Disposition: attachment` header.
 * - Authorizes itself with `draft:view` (Event members only): `src/proxy.ts`
 *   does not protect `/api`. 401 without a session, 404 for an unknown Event,
 *   403 for a signed-in user who is not a member; 404 also while the Event has
 *   no finished draft (the picture is the result, there is nothing to show
 *   before). Rate limited (`draftRecapImage`).
 */
export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const { id } = await props.params

  try {
    const allowed = await authorizeDraftView(id)
    if (!allowed.ok) return allowed.response

    const limited = await checkRateLimit("draftRecapImage", allowed.userId)
    if (!limited.allowed) return rateLimitedResponse(limited)

    const snapshot = await loadDraftSnapshot(id)
    if (!snapshot || snapshot.state.status !== "complete") {
      return NextResponse.json(
        { error: "This event has no finished draft" },
        { status: 404 }
      )
    }
    const [event] = await db
      .select({ title: events.title })
      .from(events)
      .where(eq(events.id, id))
      .limit(1)

    const players = new Map(snapshot.players.map((p) => [p.userId, p]))
    const image = buildRecapImage(
      event?.title ?? "Team draft",
      snapshot.state,
      players
    )

    const download = new URL(request.url).searchParams.get("download") === "1"
    return new ImageResponse(image.element, {
      width: image.width,
      height: image.height,
      headers: {
        "Cache-Control": "private, no-cache",
        ...(download
          ? { "Content-Disposition": 'attachment; filename="team-draft.png"' }
          : {}),
      },
    })
  } catch (error) {
    logger.error(
      { error, eventId: id },
      "Error rendering the draft recap image"
    )
    return NextResponse.json(
      { error: "An error occurred while rendering the image" },
      { status: 500 }
    )
  }
}
