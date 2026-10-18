import "server-only"

import type { EventActor } from "@/lib/authz/policy"
import { validateApiKey } from "@/lib/api-auth"
import { loadEventActor } from "./actor"

/**
 * The standing of an API key's owner in one Event, for the RuneLite routes.
 * Replaces the participant / creator lookups the routes used to carry each.
 */
export type ApiActorLookup =
  | { status: "ok"; userId: string; actor: EventActor }
  | { status: "unauthenticated" }
  | { status: "not-found" }

/**
 * Loads the actor for the owner of the request's API key in the Event. The
 * role is the participant row, exactly as for a signed-in user (one actor
 * loader for both). Pass a user id instead of the request when the route already
 * validated the key (it needs the user for rate limiting before the Event is
 * known), so the key is looked up once.
 *
 * Callers turn the lookup into HTTP: `unauthenticated` is 401; `not-found` and
 * an actor without a role are the plugin's 404 / "Not a participant" answers;
 * the permission checks use `can(actor, ...)` from `@/lib/authz/policy`.
 */
export async function getApiActor(
  requestOrUserId: Request | string,
  eventId: string
): Promise<ApiActorLookup> {
  const userId =
    typeof requestOrUserId === "string"
      ? requestOrUserId
      : await validateApiKey(requestOrUserId)
  if (!userId) return { status: "unauthenticated" }

  const lookup = await loadEventActor(userId, eventId)
  if (lookup.status !== "ok") return lookup
  return { status: "ok", userId, actor: lookup.actor }
}
