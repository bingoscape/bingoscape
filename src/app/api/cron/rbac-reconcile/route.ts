import { NextResponse } from "next/server"

import { logger } from "@/lib/logger"
import { reconcileRbac } from "@/server/authz/reconciliation"

export const dynamic = "force-dynamic" // Never cached

/**
 * Daily RBAC reconciliation (RBAC 3/8, #186). Called by host cron through
 * `scripts/rbac-reconcile.sh`, with the same `CRON_SECRET` bearer token as
 * `/api/cron/unlock`. Runs the verification queries of
 * `src/server/authz/verification.ts` and answers
 *
 * - 200 `{ ok: true, ... }` when no check with severity "error" found anything,
 * - 500 `{ ok: false, failures: [...] }` otherwise (so `curl --fail` and the
 *   cron script notice), with the first rows of every finding,
 * - 401 without the secret (fail closed while `CRON_SECRET` is unset).
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (
    !cronSecret ||
    request.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    logger.warn("Unauthorized attempt to access cron rbac-reconcile route")
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const report = await reconcileRbac()
    return NextResponse.json(report, { status: report.ok ? 200 : 500 })
  } catch (error) {
    logger.error({ error }, "Error in cron rbac-reconcile route")
    return NextResponse.json(
      { ok: false, error: "Reconciliation could not run" },
      { status: 500 }
    )
  }
}
