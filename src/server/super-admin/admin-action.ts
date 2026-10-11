/**
 * Server-only helper (not a "use server" module, so none of this is callable
 * from the browser). Every super-admin mutation is built with `adminAction`:
 *
 *   1. DB-backed super-admin check (never throws, returns a typed result)
 *   2. strict zod parse of the raw input
 *   3. per-admin rate limit
 *   4. the handler, inside one `db.transaction`
 *
 * Handlers signal expected failures by throwing `AdminActionError`, which
 * rolls the transaction back and becomes `{ success: false, code, error }`.
 */
import type { z } from "zod"

import { logger } from "@/lib/logger"
import { createRateLimiter } from "@/lib/rate-limit"
import { checkSuperAdmin, type AdminContext } from "@/lib/super-admin"
import { formatZodError } from "@/lib/validation/super-admin"
import { db } from "@/server/db"

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

/** 30 mutations / minute per admin. */
export const adminMutationLimiter = createRateLimiter(30, 60_000)

export function adminAction<S extends z.ZodTypeAny, T = void>(
  name: string,
  schema: S,
  handler: (ctx: AdminHandlerContext<z.output<S>>) => Promise<T>
): (rawInput: z.input<S>) => Promise<AdminResult<T>> {
  return async (rawInput) => {
    const check = await checkSuperAdmin()
    if (!check.ok) {
      // User id only, never the email.
      logger.warn(
        { userId: check.userId, action: name },
        "Denied super-admin mutation"
      )
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
      const data = await db.transaction((tx) =>
        handler({ tx, admin, input: parsed.data as z.output<S> })
      )
      return { success: true, data }
    } catch (error) {
      if (error instanceof AdminActionError) {
        return { success: false, code: error.code, error: error.message }
      }
      logger.error(
        { adminId: admin.adminId, action: name },
        "Super-admin mutation failed",
        error instanceof Error ? error : undefined
      )
      return {
        success: false,
        code: "failed",
        error: "Something went wrong. Nothing was changed.",
      }
    }
  }
}
