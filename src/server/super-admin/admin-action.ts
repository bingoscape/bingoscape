/**
 * Server-only helper (not a "use server" module, so none of this is callable
 * from the browser). Every super-admin mutation is built with `adminAction`:
 *
 *   1. DB-backed super-admin check (never throws, returns a typed result)
 *   2. strict zod parse of the raw input
 *   3. per-admin rate limit
 *   4. the handler, inside one `db.transaction`, which returns the audit
 *      entry that is written in that same transaction
 *
 * Handlers signal expected failures by throwing `AdminActionError`, which
 * rolls the transaction back and becomes `{ success: false, code, error }`.
 */
import type { z } from "zod"

import { logger } from "@/lib/logger"
import { createRateLimiter } from "@/lib/rate-limit"
import { checkSuperAdmin, type AdminContext } from "@/lib/super-admin"
import type { AuditDraft } from "@/lib/super-admin-audit"
import { maskEmail } from "@/lib/super-admin-email"
import { formatZodError } from "@/lib/validation/super-admin"
import { db } from "@/server/db"
import { writeAuditAttempt, writeAuditSuccess } from "./audit"

export type AdminErrorCode =
  | "forbidden"
  | "invalid"
  | "not_found"
  | "conflict"
  | "rate_limited"
  | "failed"

export type AdminResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string; code?: AdminErrorCode }

export type AdminTx = Parameters<Parameters<typeof db.transaction>[0]>[0]

export class AdminActionError extends Error {
  constructor(
    readonly code: AdminErrorCode,
    message: string
  ) {
    super(message)
    this.name = "AdminActionError"
  }
}

export const notFoundError = (what: string) =>
  new AdminActionError("not_found", `${what} not found. It may already be deleted.`)

export const conflictError = (message: string) =>
  new AdminActionError("conflict", message)

export const invalidError = (message: string) =>
  new AdminActionError("invalid", message)

export interface AdminHandlerContext<I> {
  tx: AdminTx
  admin: AdminContext
  input: I
}

/** What a handler returns: the audit entry (mandatory) and optional data for the caller. */
export interface AdminHandlerOutput<T = void> {
  audit: AuditDraft
  data?: T
}

/** 30 mutations / minute per admin. */
export const adminMutationLimiter = createRateLimiter(30, 60_000)

export function adminAction<S extends z.ZodTypeAny, T = void>(
  name: string,
  schema: S,
  handler: (
    ctx: AdminHandlerContext<z.output<S>>
  ) => Promise<AdminHandlerOutput<T>>
): (rawInput: z.input<S>) => Promise<AdminResult<T>> {
  return async (rawInput) => {
    const check = await checkSuperAdmin()
    if (!check.ok) {
      // User id only, never the email.
      logger.warn(
        { userId: check.userId, action: name },
        "Denied super-admin mutation"
      )
      await writeAuditAttempt({
        outcome: "denied",
        action: name,
        actor: check.userId ? { id: check.userId } : null,
        rawInput,
      })
      return { success: false, code: "forbidden", error: "Forbidden." }
    }
    const admin = check.admin

    const parsed = schema.safeParse(rawInput)
    if (!parsed.success) {
      return {
        success: false,
        code: "invalid",
        error: formatZodError(parsed.error),
      }
    }

    const limit = adminMutationLimiter(admin.adminId)
    if (!limit.allowed) {
      return {
        success: false,
        code: "rate_limited",
        error: `Too many changes in a short time. Try again in ${limit.retryAfterSeconds}s.`,
      }
    }

    try {
      const data = await db.transaction(async (tx) => {
        const output = await handler({
          tx,
          admin,
          input: parsed.data as z.output<S>,
        })
        // Same transaction as the mutation: no audit row, no change.
        await writeAuditSuccess(tx, admin, output.audit)
        return output.data
      })
      return { success: true, data }
    } catch (error) {
      if (error instanceof AdminActionError) {
        if (error.code === "conflict") {
          // Refused by an invariant; worth keeping a trace of.
          await writeAuditAttempt({
            outcome: "failed",
            action: name,
            actor: { id: admin.adminId, label: maskEmail(admin.email) },
            rawInput,
            reason: error.message,
          })
        }
        return { success: false, code: error.code, error: error.message }
      }
      logger.error(
        { adminId: admin.adminId, action: name },
        "Super-admin mutation failed",
        error instanceof Error ? error : undefined
      )
      await writeAuditAttempt({
        outcome: "failed",
        action: name,
        actor: { id: admin.adminId, label: maskEmail(admin.email) },
        rawInput,
        reason: "Unexpected error",
      })
      return {
        success: false,
        code: "failed",
        error: "Something went wrong. Nothing was changed.",
      }
    }
  }
}
