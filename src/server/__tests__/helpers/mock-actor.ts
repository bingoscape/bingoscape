import { buildEventActor, type ActorTeam } from "@/lib/authz/policy"
import type { EventRole } from "@/lib/authz/roles"
import type { EventActorLookup } from "@/server/authz/actor"

/**
 * For unit tests that mock the actor loader (`jest.mock("@/server/authz/actor")`)
 * instead of using a database: the lookup `getEventActor` would return for a
 * caller with `role` in the Event (null: not a member).
 */
export function actorLookup(
  role: string | null,
  options: { teams?: readonly ActorTeam[]; eventId?: string } = {}
): EventActorLookup {
  return {
    status: "ok",
    actor: buildEventActor({
      userId: "user-1",
      eventId: options.eventId ?? "event-from-db",
      creatorId: null,
      participantRole: role as EventRole | null,
      teams: options.teams ?? [],
    }),
  }
}
