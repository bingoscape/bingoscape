import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { sweepExpiredDrafts } from "@/server/draft/expire"

export const dynamic = "force-dynamic" // Never cached

/**
 * Optional backstop for the pick timer (team draft 3/4, #217): resolves every
 * draft turn whose deadline has passed, exactly like the once-per-second
 * sweeper that runs inside the app process (and under the same advisory lock,
 * so the two never act at once). Same `CRON_SECRET` bearer token as the other
 * cron routes; fail closed while it is unset.
 *
 * - 200 `{ ok: true, locked, resolved }`; `locked: false` means another
 *   sweeper was running and nothing was done,
 * - 401 without the secret, 500 when the sweep itself failed.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    logger.warn("Unauthorized attempt to access cron draft-sweep route")
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const result = await sweepExpiredDrafts()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    logger.error({ error }, "Error in cron draft-sweep route")
    return NextResponse.json(
      { ok: false, error: "The sweep could not run" },
      { status: 500 }
    )
  }
}
