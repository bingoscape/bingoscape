/**
 * Server-only audit log writer (not a "use server" module).
 * Successful mutations are written inside the mutation's transaction; denied
 * and refused attempts are written best-effort and never throw.
 */
import { headers } from "next/headers"

import { logger } from "@/lib/logger"
import { createRateLimiter } from "@/lib/rate-limit"
import { maskEmail } from "@/lib/super-admin-email"
import {
  targetIdFromInput,
  targetTypeFromAction,
  type AuditDraft,
  type AuditOutcome,
} from "@/lib/super-admin-audit"
import { db } from "@/server/db"
import { adminAuditLog } from "@/server/db/schema"

type Executor = Pick<typeof db, "insert">

interface RequestMeta {
  requestId: string | null
  ip: string | null
}

async function requestMeta(): Promise<RequestMeta> {
  try {
    const h = await headers()
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim()
    return {
      requestId: h.get("x-request-id")?.slice(0, 100) ?? null,
      ip: (forwarded ?? h.get("x-real-ip") ?? null)?.slice(0, 64) ?? null,
    }
  } catch {
    // No request scope (tests, scripts).
    return { requestId: null, ip: null }
  }
}

/** Writes a success row using the caller's transaction. Errors propagate so the mutation rolls back. */
export async function writeAuditSuccess(
  executor: Executor,
  admin: { adminId: string; email: string },
  draft: AuditDraft
) {
  const meta = await requestMeta()
  await executor.insert(adminAuditLog).values({
    actorId: admin.adminId,
    actorLabel: maskEmail(admin.email),
    action: draft.action,
    targetType: draft.targetType,
    targetId: draft.targetId,
    targetLabel: draft.targetLabel ?? null,
    before: draft.before ?? null,
    after: draft.after ?? null,
    reason: draft.reason ?? null,
    outcome: "success",
    requestId: meta.requestId,
    ip: meta.ip,
  })
}

/** Caps rows written for denied attempts per user, so a non-admin cannot flood the table. */
const deniedLimiter = createRateLimiter(10, 60_000)

/**
 * Best-effort row for a denied or refused attempt. Anonymous callers are not
 * recorded (they only reach the application logs), and writes are rate-limited
 * per user. Never throws.
 */
export async function writeAuditAttempt(params: {
  outcome: Exclude<AuditOutcome, "success">
  action: string
  actor: { id: string; label?: string | null } | null
  rawInput: unknown
  reason?: string
}) {
  try {
    if (!params.actor) return
    if (!deniedLimiter(params.actor.id).allowed) return

    const targetType = targetTypeFromAction(params.action)
    if (!targetType) return
    const meta = await requestMeta()
    await db.insert(adminAuditLog).values({
      actorId: params.actor.id,
      actorLabel: params.actor.label ?? null,
      action: params.action,
      targetType,
      targetId: targetIdFromInput(params.rawInput),
      reason: params.reason?.slice(0, 500) ?? null,
      outcome: params.outcome,
      requestId: meta.requestId,
      ip: meta.ip,
    })
  } catch (error) {
    logger.warn(
      { action: params.action, error },
      "Could not write super-admin audit attempt"
    )
  }
}
