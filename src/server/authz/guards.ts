import "server-only"

import { can, type EventActor, type PolicyResource } from "@/lib/authz/policy"
import type { Permission } from "@/lib/authz/permissions"
import { isManagerRole, type EventRole } from "@/lib/authz/roles"
import { getServerAuthSession } from "@/server/auth"
import { getEventActor, getEventRole } from "./actor"
import { AuthzError, type AuthzErrorCode } from "./errors"

/**
 * Server-side guards.
 *
 * Rules:
 * - The Event is always derived from the database (from the Tile, Goal, ...
 *   being mutated), never from a client supplied eventId (see `resolve.ts`).
 * - "Manager" means the caller holds the `admin` or `management` role for that
 *   Event (the creator counts as admin).
 * - `authorize()` returns a typed result; `requirePermission()` and the
 *   `require*` helpers throw `AuthzError`.
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

// ---------------------------------------------------------------------------
// Existing helpers (compatibility shim). Same names, messages and behaviour as
// before the policy layer; they resolve the role through the actor loader.
// ---------------------------------------------------------------------------

const FORBIDDEN_MANAGER = "Forbidden: admin or management role required"

export async function requireSession(): Promise<{ userId: string }> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    throw new AuthzError(MESSAGES.UNAUTHENTICATED, "UNAUTHENTICATED")
  }
  return { userId: session.user.id }
}

/**
 * Requires a signed-in admin/management member of the given Event.
 * Returns the eventId on success.
 */
export async function requireEventManager(eventId: string): Promise<string> {
  await requireSession()
  const role = await getEventRole(eventId)
  if (!isManagerRole(role)) {
    throw new AuthzError(FORBIDDEN_MANAGER)
  }
  return eventId
}

/**
 * Requires a signed-in admin of the given Event (the creator counts as admin).
 * Returns the eventId on success.
 */
export async function requireEventAdmin(eventId: string): Promise<string> {
  await requireSession()
  const role = await getEventRole(eventId)
  if (role !== "admin") throw new AuthzError("Forbidden: admin role required")
  return eventId
}

/**
 * Requires a signed-in member of the given Event (any role, creator included).
 * Returns the caller's role.
 */
export async function requireEventMember(eventId: string): Promise<EventRole> {
  await requireSession()
  const role = await getEventRole(eventId)
  if (!role) throw new AuthzError("Forbidden: not a member of this event")
  return role
}

/** True when the signed-in caller manages the Event (admin or management). */
export async function isEventManager(eventId: string): Promise<boolean> {
  return isManagerRole(await getEventRole(eventId))
}
