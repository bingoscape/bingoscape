import "server-only"

import { can, type EventActor, type PolicyResource } from "@/lib/authz/policy"
import type { Permission } from "@/lib/authz/permissions"
import { logger } from "@/lib/logger"
import { getServerAuthSession } from "@/server/auth"
import { getEventActor } from "./actor"
import { AuthzError, type AuthzErrorCode } from "./errors"

/**
 * Server-side guards.
 *
 * Rules:
 * - The Event is always derived from the database (from the Tile, Goal, ...
 *   being mutated), never from a client supplied eventId (see `resolve.ts`).
 * - Who may do what lives in one place, the permission map in
 *   `@/lib/authz/permissions`. Call sites name a permission; they never compare
 *   roles themselves (a test fails the build when one does).
 * - `authorize()` returns a typed result; `requirePermission()` and the
 *   `require*For*` resolver helpers throw `AuthzError`; `hasPermission()` is the
 *   boolean for reads that decide what to show.
 * - Every export of a "use server" file and every route handler is registered
 *   in `registry.ts` with the permission it needs (or why it is public).
 *
 * Return conventions (one per kind of function, applied everywhere):
 *
 * 1. Mutations (server actions that change data) return an `ActionResult`:
 *    `{ success: true, ...data }` or `{ success: false, error, code? }`. They
 *    never throw for an expected failure. A denied caller gets
 *    `code: "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND"`, built with
 *    `denial(authorizeResult)` or `actionFailure(error, fallback)` (which turns
 *    a thrown `AuthzError` into the same shape and hides every other error
 *    behind `fallback`). Clients show `error` in a destructive toast.
 *
 * 2. Reads that return data (lists, objects, numbers) keep their data type and
 *    return the type's empty value (`[]`, `null`, `0`, a zeroed object) when the
 *    caller may not see the data. This is deliberate: a denial looks exactly
 *    like "nothing there", so an id cannot be probed for existence, and pages
 *    that already handle the empty case need no error path. A read function
 *    never throws `AuthzError` for a denial; a database failure still throws.
 *    Mark the denial with a `// Deliberate:` comment where it is not obvious.
 *    Pages that must distinguish "not allowed" check `hasPermission()` /
 *    `authorize()` themselves before they call the read.
 *
 * 3. Route handlers answer with HTTP status codes: 401 for no or an invalid
 *    credential, 403 for a known caller without the permission and 404 where
 *    the resource must not reveal that it exists (the RuneLite plugin and the
 *    comments route use 404 for both a missing resource and a denial).
 *
 * This is intentionally not a "use server" module: the helpers are not
 * callable from the client.
 */

const MESSAGES: Record<AuthzErrorCode, string> = {
  UNAUTHENTICATED: "Unauthorized",
  FORBIDDEN: "Forbidden: insufficient permissions",
  NOT_FOUND: "Event not found",
}

export type AuthorizeResult =
  | { success: true; actor: EventActor }
  | { success: false; error: string; code: AuthzErrorCode }

/**
 * Checks `permission` for the signed-in user in the Event. Never throws for an
 * expected denial; a database failure still throws.
 */
export async function authorize(
  eventId: string,
  permission: Permission,
  resource?: PolicyResource
): Promise<AuthorizeResult> {
  const lookup = await getEventActor(eventId)
  if (lookup.status === "unauthenticated") {
    return {
      success: false,
      code: "UNAUTHENTICATED",
      error: MESSAGES.UNAUTHENTICATED,
    }
  }
  if (lookup.status === "not-found") {
    return { success: false, code: "NOT_FOUND", error: MESSAGES.NOT_FOUND }
  }
  if (!can(lookup.actor, permission, resource)) {
    return { success: false, code: "FORBIDDEN", error: MESSAGES.FORBIDDEN }
  }
  return { success: true, actor: lookup.actor }
}

/** Like `authorize` but throws `AuthzError`; returns the actor on success. */
export async function requirePermission(
  eventId: string,
  permission: Permission,
  resource?: PolicyResource
): Promise<EventActor> {
  const result = await authorize(eventId, permission, resource)
  if (!result.success) throw new AuthzError(result.error, result.code)
  return result.actor
}

/**
 * True when the signed-in caller holds `permission` in the Event. Never throws:
 * a signed-out caller, a missing Event and a failed lookup all answer false
 * (fail closed). Use it where a read decides what to return; use `authorize`
 * where the caller needs the reason.
 */
export async function hasPermission(
  eventId: string,
  permission: Permission,
  resource?: PolicyResource
): Promise<boolean> {
  try {
    const lookup = await getEventActor(eventId)
    return lookup.status === "ok" && can(lookup.actor, permission, resource)
  } catch (error) {
    logger.error({ error }, "Error checking permission")
    return false
  }
}

/** Requires a signed-in user (no Event involved). */
export async function requireSession(): Promise<{ userId: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new AuthzError(MESSAGES.UNAUTHENTICATED, "UNAUTHENTICATED")
  }
  return { userId: session.user.id }
}

// ---------------------------------------------------------------------------
// Action results
// ---------------------------------------------------------------------------

export type ActionErrorCode = AuthzErrorCode | "INVALID" | "CONFLICT" | "FAILED"

export interface ActionFailure {
  success: false
  error: string
  code?: ActionErrorCode
}

/** `{ success: true, ...T }` or an `ActionFailure`. */
export type ActionResult<T extends object = object> =
  | ({ success: true } & T)
  | ActionFailure

/** The failure for a denied `authorize()` result. */
export function denial(
  result: Extract<AuthorizeResult, { success: false }>
): ActionFailure {
  return { success: false, error: result.error, code: result.code }
}

/** A failure with an explicit message and code. */
export function failure(
  error: string,
  code?: ActionErrorCode
): ActionFailure {
  return code ? { success: false, error, code } : { success: false, error }
}

/**
 * The failure for a refused membership change (`changeRole` and friends): the
 * ownership and role-ceiling rules are permission problems, the rest are
 * conflicts with the current state.
 */
export function membershipFailure(result: {
  error: string
  code: string
}): ActionFailure {
  const code: ActionErrorCode =
    result.code === "UNAUTHENTICATED" ||
    result.code === "FORBIDDEN" ||
    result.code === "NOT_FOUND" ||
    result.code === "INVALID"
      ? result.code
      : result.code === "OWNER_ONLY" || result.code === "ROLE_CEILING"
        ? "FORBIDDEN"
        : "CONFLICT"
  return { success: false, error: result.error, code }
}

/**
 * The failure for something that was thrown: an `AuthzError` keeps its message
 * and code, anything else becomes `fallback` (internals are never sent to the
 * client).
 */
export function actionFailure(
  error: unknown,
  fallback: string,
  fallbackCode: ActionErrorCode = "FAILED"
): ActionFailure {
  if (error instanceof AuthzError) {
    return { success: false, error: error.message, code: error.code }
  }
  return { success: false, error: fallback, code: fallbackCode }
}
