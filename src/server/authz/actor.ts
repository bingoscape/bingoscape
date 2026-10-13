import "server-only"

import { and, asc, eq } from "drizzle-orm"
import { cache } from "react"

import { buildEventActor, type EventActor } from "@/lib/authz/policy"
import { EVENT_ROLE_RANK, type EventRole } from "@/lib/authz/roles"
import { logger } from "@/lib/logger"
import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import {
  eventParticipants,
  events,
  teamMembers,
  teams,
} from "@/server/db/schema"

/** The admin participant with the oldest row, or null when there is none. */
export async function oldestAdminId(eventId: string): Promise<string | null> {
  const [row] = await db
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.role, "admin")
      )
    )
    .orderBy(asc(eventParticipants.createdAt), asc(eventParticipants.id))
    .limit(1)
  return row?.userId ?? null
}

/** Outcome of looking up the signed-in user's standing in one Event. */
export type EventActorLookup =
  | { status: "ok"; actor: EventActor }
  | { status: "unauthenticated" }
  | { status: "not-found" }

/**
 * Loads the signed-in user's standing in an Event with one joined query: the
 * Event creator, the participant row and the Team memberships. The creator
 * counts as admin (normalised in `buildEventActor`, nowhere else).
 *
 * Wrapped in React `cache()`, so within one request every guard, resolver and
 * component that asks about the same Event shares one lookup. A database error
 * throws; `getEventRole` turns it into "no role" (fail closed).
 */
export const getEventActor = cache(
  async (eventId: string): Promise<EventActorLookup> => {
    const session = await getServerAuthSession()
    const userId = session?.user?.id
    if (!userId) return { status: "unauthenticated" }

    const myTeams = db
      .select({
        teamId: teamMembers.teamId,
        isLeader: teamMembers.isLeader,
        eventId: teams.eventId,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(and(eq(teamMembers.userId, userId), eq(teams.eventId, eventId)))
      .as("my_teams")

    const rows = await db
      .select({
        creatorId: events.creatorId,
        participantRole: eventParticipants.role,
        teamId: myTeams.teamId,
        isLeader: myTeams.isLeader,
      })
      .from(events)
      .leftJoin(
        eventParticipants,
        and(
          eq(eventParticipants.eventId, events.id),
          eq(eventParticipants.userId, userId)
        )
      )
      .leftJoin(myTeams, eq(myTeams.eventId, events.id))
      .where(eq(events.id, eventId))

    const first = rows[0]
    if (!first) return { status: "not-found" }

    // The joins can repeat a Team or the participant row; collapse them.
    const teamsById = new Map<string, boolean>()
    let participantRole: EventRole | null = null
    for (const row of rows) {
      if (row.teamId !== null) {
        teamsById.set(
          row.teamId,
          (teamsById.get(row.teamId) ?? false) || (row.isLeader ?? false)
        )
      }
      if (
        row.participantRole !== null &&
        (participantRole === null ||
          EVENT_ROLE_RANK[row.participantRole] >
            EVENT_ROLE_RANK[participantRole])
      ) {
        participantRole = row.participantRole
      }
    }

    // An Event whose creator account is gone is owned by its oldest admin.
    const ownerFallbackId =
      first.creatorId === null ? await oldestAdminId(eventId) : null

    return {
      status: "ok",
      actor: buildEventActor({
        userId,
        eventId,
        creatorId: first.creatorId,
        ownerFallbackId,
        participantRole,
        teams: [...teamsById].map(([teamId, isLeader]) => ({
          teamId,
          isLeader,
        })),
      }),
    }
  }
)

/**
 * The signed-in user's effective role in the Event (the creator counts as
 * admin), or null when signed out, not a member, the Event does not exist or
 * the lookup failed. Never throws.
 */
export async function getEventRole(eventId: string): Promise<EventRole | null> {
  try {
    const lookup = await getEventActor(eventId)
    return lookup.status === "ok" ? lookup.actor.role : null
  } catch (error) {
    logger.error({ error }, "Error fetching user role")
    return null
  }
}
