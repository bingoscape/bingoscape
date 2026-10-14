import { and, asc, desc, eq, inArray, sql } from "drizzle-orm"
import { capabilitiesForMembership } from "@/lib/authz/capabilities"
import { isManagerRole } from "@/lib/authz/roles"

import { db } from "@/server/db"
import {
  clanInvites,
  clanMembers,
  clans,
  eventBuyIns,
  eventDonations,
  eventParticipants,
  eventRegistrationRequests,
  events,
  teamMembers,
  teamTileSubmissions,
  teams,
  tiles,
  users,
} from "@/server/db/schema"
import type { EventData, EventRole } from "@/app/actions/events"
import {
  resolveInviteState,
  type ClanRole,
  type InvitePreviewState,
} from "@/lib/clan"

/**
 * Read-only clan queries for Server Components. Deliberately not server
 * actions: nothing here is callable from the client, and every function takes
 * the viewer's id explicitly so authorization is visible at the call site.
 */

export interface ClanPerson {
  id: string
  name: string | null
  runescapeName: string | null
  image: string | null
}

export interface UserClanSummary {
  id: string
  name: string
  description: string | null
  isMain: boolean
  role: ClanRole
  owner: ClanPerson | null
  memberCount: number
  eventCount: number
}

const roleOrder = sql`CASE
  WHEN ${clanMembers.role} = 'admin' THEN 1
  WHEN ${clanMembers.role} = 'management' THEN 2
  WHEN ${clanMembers.role} = 'member' THEN 3
  WHEN ${clanMembers.role} = 'guest' THEN 4
  ELSE 5
END`

/** Member and event counts for a set of clans, in two grouped queries. */
async function getClanCounts(clanIds: string[]) {
  if (clanIds.length === 0) {
    return {
      members: new Map<string, number>(),
      events: new Map<string, number>(),
    }
  }
  const [memberRows, eventRows] = await Promise.all([
    db
      .select({
        clanId: clanMembers.clanId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(clanMembers)
      .where(inArray(clanMembers.clanId, clanIds))
      .groupBy(clanMembers.clanId),
    db
      .select({
        clanId: events.clanId,
        count: sql<number>`count(*)`.mapWith(Number),
      })
      .from(events)
      .where(inArray(events.clanId, clanIds))
      .groupBy(events.clanId),
  ])
  return {
    members: new Map(memberRows.map((r) => [r.clanId, r.count])),
    events: new Map(
      eventRows.flatMap((r) => (r.clanId ? [[r.clanId, r.count] as const] : []))
    ),
  }
}

/** The viewer's clans for the /clans list: main clan first, then by name. */
export async function getUserClanSummaries(
  userId: string
): Promise<UserClanSummary[]> {
  const rows = await db
    .select({
      id: clans.id,
      name: clans.name,
      description: clans.description,
      isMain: clanMembers.isMain,
      role: clanMembers.role,
      ownerId: users.id,
      ownerName: users.name,
      ownerRsn: users.runescapeName,
      ownerImage: users.image,
    })
    .from(clanMembers)
    .innerJoin(clans, eq(clans.id, clanMembers.clanId))
    .leftJoin(users, eq(users.id, clans.ownerId))
    .where(eq(clanMembers.userId, userId))

  const counts = await getClanCounts(rows.map((r) => r.id))

  return rows
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      isMain: r.isMain,
      role: r.role,
      owner: r.ownerId
        ? {
            id: r.ownerId,
            name: r.ownerName,
            runescapeName: r.ownerRsn,
            image: r.ownerImage,
          }
        : null,
      memberCount: counts.members.get(r.id) ?? 0,
      eventCount: counts.events.get(r.id) ?? 0,
    }))
    .sort(
      (a, b) =>
        Number(b.isMain) - Number(a.isMain) || a.name.localeCompare(b.name)
    )
}

export interface ClanOverview {
  id: string
  name: string
  description: string | null
  ownerId: string | null
  owner: ClanPerson | null
  memberCount: number
  eventCount: number
  viewer: { userId: string; role: ClanRole; isMain: boolean }
}

/** Clan header data. Returns null unless `userId` is a member (so: a 404). */
export async function getClanOverview(
  clanId: string,
  userId: string
): Promise<ClanOverview | null> {
  const membership = await db.query.clanMembers.findFirst({
    where: and(eq(clanMembers.clanId, clanId), eq(clanMembers.userId, userId)),
  })
  if (!membership) return null

  const [clan, counts] = await Promise.all([
    db.query.clans.findFirst({ where: eq(clans.id, clanId) }),
    getClanCounts([clanId]),
  ])
  if (!clan) return null

  const owner = clan.ownerId
    ? ((await db.query.users.findFirst({
        where: eq(users.id, clan.ownerId),
        columns: { id: true, name: true, runescapeName: true, image: true },
      })) ?? null)
    : null

  return {
    id: clan.id,
    name: clan.name,
    description: clan.description,
    ownerId: clan.ownerId,
    owner,
    memberCount: counts.members.get(clanId) ?? 0,
    eventCount: counts.events.get(clanId) ?? 0,
    viewer: { userId, role: membership.role, isMain: membership.isMain },
  }
}

export interface ClanMemberRow extends ClanPerson {
  role: ClanRole
  isMain: boolean
  joinedAt: Date
}

/** Caller must have verified membership (see `getClanOverview`). */
export async function getClanMemberRows(
  clanId: string
): Promise<ClanMemberRow[]> {
  return db
    .select({
      id: users.id,
      name: users.name,
      runescapeName: users.runescapeName,
      image: users.image,
      role: clanMembers.role,
      isMain: clanMembers.isMain,
      joinedAt: clanMembers.joinedAt,
    })
    .from(clanMembers)
    .innerJoin(users, eq(clanMembers.userId, users.id))
    .where(eq(clanMembers.clanId, clanId))
    .orderBy(roleOrder, asc(users.runescapeName), asc(users.name))
}

export type ClanEventRegistration = "joined" | "pending" | "none"

export interface ClanEventRow {
  eventData: EventData
  registration: ClanEventRegistration
}

/**
 * The clan's events with prize pools, the viewer's team/progress and their
 * registration state, in a fixed number of queries (no per-event lookups).
 * Caller must have verified membership.
 */
export async function getClanEventRows(
  clanId: string,
  userId: string
): Promise<ClanEventRow[]> {
  const clanEvents = await db.query.events.findMany({
    where: eq(events.clanId, clanId),
    with: {
      clan: true,
      bingos: true,
      eventParticipants: { where: eq(eventParticipants.userId, userId) },
    },
    orderBy: [desc(events.startDate)],
  })
  if (clanEvents.length === 0) return []

  const eventIds = clanEvents.map((e) => e.id)

  const [buyIns, donations, pendingRequests, userTeams] = await Promise.all([
    db
      .select({
        eventId: eventParticipants.eventId,
        total: sql<number>`COALESCE(SUM(${eventBuyIns.amount}), 0)`.mapWith(
          Number
        ),
      })
      .from(eventBuyIns)
      .innerJoin(
        eventParticipants,
        eq(eventBuyIns.eventParticipantId, eventParticipants.id)
      )
      .where(inArray(eventParticipants.eventId, eventIds))
      .groupBy(eventParticipants.eventId),
    db
      .select({
        eventId: eventParticipants.eventId,
        total: sql<number>`COALESCE(SUM(${eventDonations.amount}), 0)`.mapWith(
          Number
        ),
      })
      .from(eventDonations)
      .innerJoin(
        eventParticipants,
        eq(eventDonations.eventParticipantId, eventParticipants.id)
      )
      .where(inArray(eventParticipants.eventId, eventIds))
      .groupBy(eventParticipants.eventId),
    db
      .select({ eventId: eventRegistrationRequests.eventId })
      .from(eventRegistrationRequests)
      .where(
        and(
          inArray(eventRegistrationRequests.eventId, eventIds),
          eq(eventRegistrationRequests.userId, userId),
          eq(eventRegistrationRequests.status, "pending")
        )
      ),
    db
      .select({
        eventId: teams.eventId,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(and(inArray(teams.eventId, eventIds), eq(teamMembers.userId, userId))),
  ])

  const teamIds = userTeams.map((t) => t.teamId)
  const bingoIds = clanEvents.flatMap((e) => e.bingos.map((b) => b.id))
  const [memberCounts, completed, tileTotals] = await Promise.all([
    teamIds.length
      ? db
          .select({
            teamId: teamMembers.teamId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(teamMembers)
          .where(inArray(teamMembers.teamId, teamIds))
          .groupBy(teamMembers.teamId)
      : Promise.resolve([]),
    teamIds.length
      ? db
          .select({
            teamId: teamTileSubmissions.teamId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(teamTileSubmissions)
          .where(
            and(
              inArray(teamTileSubmissions.teamId, teamIds),
              eq(teamTileSubmissions.status, "completed")
            )
          )
          .groupBy(teamTileSubmissions.teamId)
      : Promise.resolve([]),
    bingoIds.length
      ? db
          .select({
            bingoId: tiles.bingoId,
            count: sql<number>`count(*)`.mapWith(Number),
          })
          .from(tiles)
          .where(inArray(tiles.bingoId, bingoIds))
          .groupBy(tiles.bingoId)
      : Promise.resolve([]),
  ])

  const buyInByEvent = new Map(buyIns.map((r) => [r.eventId, r.total]))
  const donationByEvent = new Map(donations.map((r) => [r.eventId, r.total]))
  const pending = new Set(pendingRequests.map((r) => r.eventId))
  const teamByEvent = new Map(userTeams.map((t) => [t.eventId, t]))
  const memberCountByTeam = new Map(memberCounts.map((r) => [r.teamId, r.count]))
  const completedByTeam = new Map(completed.map((r) => [r.teamId, r.count]))
  const tilesByBingo = new Map(tileTotals.map((r) => [r.bingoId, r.count]))

  return clanEvents.map((event) => {
    const participant = event.eventParticipants[0]
    const role: EventRole =
      event.creatorId === userId ? "admin" : (participant?.role ?? "participant")
    const isManager = isManagerRole(role)
    const team = teamByEvent.get(event.id)

    const eventData: EventData = {
      event: { ...event, role },
      capabilities: capabilitiesForMembership({
        userId,
        eventId: event.id,
        creatorId: event.creatorId,
        participantRole: participant?.role ?? null,
      }),
      totalPrizePool:
        event.basePrizePool +
        (buyInByEvent.get(event.id) ?? 0) +
        (donationByEvent.get(event.id) ?? 0),
      participantData: team
        ? {
            team: {
              id: team.teamId,
              name: team.teamName,
              memberCount: memberCountByTeam.get(team.teamId) ?? 0,
            },
            progress: {
              completedTiles: completedByTeam.get(team.teamId) ?? 0,
              totalTiles: event.bingos
                .filter((b) => isManager || b.visible)
                .reduce((sum, b) => sum + (tilesByBingo.get(b.id) ?? 0), 0),
            },
          }
        : undefined,
    }

    const registration: ClanEventRegistration =
      participant || event.creatorId === userId
        ? "joined"
        : pending.has(event.id)
          ? "pending"
          : "none"

    return { eventData, registration }
  })
}

/** Managers only (caller checks). Newest first, with creator for attribution. */
export async function getClanInviteRows(clanId: string) {
  return db.query.clanInvites.findMany({
    where: eq(clanInvites.clanId, clanId),
    with: {
      creator: {
        columns: { id: true, name: true, runescapeName: true, image: true },
      },
    },
    orderBy: [desc(clanInvites.createdAt)],
  })
}

export type ClanInviteRow = Awaited<ReturnType<typeof getClanInviteRows>>[number]

export type ClanInvitePreview =
  | { state: "invalid" }
  | {
      state: Exclude<InvitePreviewState, "ready">
      clan: { id: string; name: string }
    }
  | {
      state: "ready"
      clan: {
        id: string
        name: string
        description: string | null
        memberCount: number
        owner: ClanPerson | null
      }
      invite: { label: string | null; expiresAt: Date | null; usesLeft: number | null }
      /** True when this would be the viewer's first clan, so it becomes Main. */
      becomesMain: boolean
    }

/**
 * What the join page shows for an invite code. Read-only: it never consumes
 * the invite and only exposes the clan's name, description, owner and member
 * count (no member list).
 */
export async function getClanInvitePreview(
  code: string,
  userId: string
): Promise<ClanInvitePreview> {
  const invite = await db.query.clanInvites.findFirst({
    where: eq(clanInvites.inviteCode, code),
    with: { clan: true },
  })
  if (!invite) return { state: "invalid" }

  const memberships = await db.query.clanMembers.findMany({
    where: eq(clanMembers.userId, userId),
    columns: { clanId: true, isMain: true },
  })
  const isMember = memberships.some((m) => m.clanId === invite.clanId)
  const state = resolveInviteState(invite, isMember)

  if (state !== "ready") {
    return { state, clan: { id: invite.clan.id, name: invite.clan.name } }
  }

  const [counts, owner] = await Promise.all([
    getClanCounts([invite.clanId]),
    invite.clan.ownerId
      ? db.query.users.findFirst({
          where: eq(users.id, invite.clan.ownerId),
          columns: { id: true, name: true, runescapeName: true, image: true },
        })
      : Promise.resolve(undefined),
  ])

  return {
    state: "ready",
    clan: {
      id: invite.clan.id,
      name: invite.clan.name,
      description: invite.clan.description,
      memberCount: counts.members.get(invite.clanId) ?? 0,
      owner: owner ?? null,
    },
    invite: {
      label: invite.label,
      expiresAt: invite.expiresAt,
      usesLeft:
        invite.maxUses === null ? null : invite.maxUses - invite.currentUses,
    },
    becomesMain: memberships.length === 0,
  }
}
