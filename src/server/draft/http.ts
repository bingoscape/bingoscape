import "server-only"

import { NextResponse } from "next/server"

import { authorize } from "@/server/authz"

/**
 * Shared by the draft route handlers: `src/proxy.ts` does not protect `/api`,
 * so each route authorizes itself with `draft:view` and answers 401 without a
 * session, 404 for an unknown Event and 403 to a signed-in non-member.
 */
export async function authorizeDraftView(
  eventId: string
): Promise<
  { ok: true; userId: string } | { ok: false; response: NextResponse }
> {
  const allowed = await authorize(eventId, "draft:view")
  if (allowed.success) return { ok: true, userId: allowed.actor.userId }
  const status =
    allowed.code === "UNAUTHENTICATED"
      ? 401
      : allowed.code === "NOT_FOUND"
        ? 404
        : 403
  return {
    ok: false,
    response: NextResponse.json({ error: allowed.error }, { status }),
  }
}

/** A non-negative integer from a query value or header, else null. */
export function parseSeq(raw: string | null): number | null {
  if (raw === null || raw.trim() === "") return null
  const value = Number(raw)
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}
