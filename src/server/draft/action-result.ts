import "server-only"

import { logger } from "@/lib/logger"
import { failure, type ActionResult } from "@/server/authz/guards"

/** What a `next-safe-action` call resolves to. */
interface SafeActionOutcome<T extends object> {
  data?: ActionResult<T>
  serverError?: string
  validationErrors?: unknown
}

const GENERIC = "Something went wrong. Please try again."

/**
 * Turns the outcome of an `eventAction` into the `{ success, error? }` result
 * every server action returns (AGENTS.md). The action body already returns an
 * `ActionResult`; the safe-action client adds a failed input validation and,
 * for an `AuthzError` or any thrown error, a `serverError` string. Only the
 * guard's own messages are passed on: anything else (a database error, say)
 * is logged and hidden behind a generic message.
 */
export function toActionResult<T extends object>(
  outcome: SafeActionOutcome<T> | undefined
): ActionResult<T> {
  if (!outcome) return failure(GENERIC, "FAILED")
  if (outcome.data) return outcome.data
  if (outcome.validationErrors) return failure("Invalid input", "INVALID")
  const message = outcome.serverError
  if (message === "Unauthorized") return failure(message, "UNAUTHENTICATED")
  if (message?.startsWith("Forbidden")) return failure(message, "FORBIDDEN")
  if (message?.endsWith(" not found")) return failure(message, "NOT_FOUND")
  logger.error({ serverError: message }, "Draft action failed")
  return failure(GENERIC, "FAILED")
}
