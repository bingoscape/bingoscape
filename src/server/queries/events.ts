import "server-only"

import { cache } from "react"
import { eq, and, asc, inArray, sql } from "drizzle-orm"
import { db } from "@/server/db"
import { getServerAuthSession } from "@/server/auth"
import {
  events,
  tiles,
  eventParticipants,
  teams,
  eventBuyIns,
  eventDonations,
  bingos,
  eventRegistrationRequests,
  submissions,
  teamTileSubmissions,
  teamMembers,
} from "@/server/db/schema"
import { logger } from "@/lib/logger"
import { redactHiddenTiles } from "@/lib/hidden-tiles"
import { applyBlindBoard, isBlindBoard } from "@/server/blind-board"
import { getViewerTeamId } from "@/server/battleship"
import { keepOwnTeamRecords } from "@/lib/battleship-privacy"
import type { EventData, GetEventByIdResult } from "@/app/actions/events"
import { levelAllows } from "@/lib/authz/read-policy"
import { getEventReadAccess, redactBoardForViewer } from "@/server/authz/read"

/**
 * The Event a viewer opens. What they get depends on the read policy
 * (`@/lib/authz/read-policy`):
 *
 * - participants and managers: the Event with its Boards, Tiles, Teams and
 *   Clan. Non-managers see visible Boards only, hidden Tiles are redacted,
 *   battleship Boards are blind until the Event starts and keep only the
 *   viewer's own Team's records; secrets (tracker verification code,
 *   codephrase) follow the policy.
 * - everybody else who may see that the Event exists (decision 3: the holder of
 *   the link of a non-public Event, anybody for a public one): the Event row
 *   only, no Boards, Teams or Clan, and `userRole: null`. This is the join
 *   card the Event page shows.
 * - nobody else (no such Event, or `members-only` and the viewer is no member):
 *   null.
 *
 * Not a "use server" module: every export of one is a public endpoint, and
 * this is only called by server components.
 */
export const getEventById = cache(async function getEventById(
  eventId: string
): Promise<GetEventByIdResult | null> {
  const access = await getEventReadAccess(eventId)
  if (!access || !levelAllows(access.level, "summary")) return null

  if (!levelAllows(access.level, "member-data")) {
    const summary = await db.query.events.findFirst({
      where: eq(events.id, eventId),
    })
    if (!summary) return null
    return {
      event: { ...summary, bingos: [], teams: [], clan: null },
      userRole: access.role,
    }
  }

  const event = await db.query.events.findFirst({
    where: eq(events.id, eventId),
    with: {
      bingos: {
        orderBy: [asc(bingos.createdAt)],
        with: {
          tiles: {
            orderBy: [asc(tiles.index)],
            with: {
              teamTileSubmissions: {
                with: {
                  submissions: {
                    with: {
                      image: true,
                      user: {
                        columns: { id: true, name: true, runescapeName: true },
                      },
                    },
                  },
                  team: true,
                },
              },
              goals: {
                with: {
                  teamProgress: true,
                  goalValues: true,
                  itemGoal: true,
                  metricGoal: true,
                },
              },
              goalGroups: true,
            },
          },
        },
      },
      clan: true,
      teams: true,
    },
  })

  if (!event) {
    return null
  }

  // Filter out non-visible bingos if the user is not admin or management, and
  // strip the content of hidden Tiles server-side (the cell itself stays).
  // Battleship boards are blind until the Event starts: every Tile keeps its id
  // and grid position but loses its content (see `blind-board.ts`). Every Tile
  // carries an explicit `isBlind`.
  const isManager = access.isManager
  if (!isManager) {
    // Battleship: only the viewer's own Team's records, so nobody can read what
    // the opponent completed (and therefore hit) from the page data.
    const ownTeamId = event.bingos.some((b) => b.bingoType === "battleship")
      ? await getViewerTeamId(eventId)
      : null
    event.bingos = event.bingos
      .filter((b) => b.visible === true)
      .map((b) => {
        const blind = isBlindBoard({
          bingoType: b.bingoType,
          startDate: event.startDate,
          isManager,
        })
        return {
          ...redactBoardForViewer(b, access),
          tiles: applyBlindBoard(
            redactHiddenTiles(
              b.bingoType === "battleship"
                ? b.tiles.map((t) => keepOwnTeamRecords(t, ownTeamId))
                : b.tiles
            ),
            blind
          ),
        }
      })
  } else {
    event.bingos = event.bingos.map((b) => ({
      ...b,
      tiles: applyBlindBoard(b.tiles, false),
    }))
  }

  return {
    event,
    userRole: access.role,
  }
})

export async function getEvents(userId: string): Promise<EventData[]> {
  // Only the signed-in user may list their own events.
  const session = await getServerAuthSession()
  if (!session?.user || session.user.id !== userId) return []

  try {
    const userEvents = await db.query.events.findMany({
      where: (events, { or, eq, exists }) =>
        or(
          eq(events.creatorId, userId),
          exists(
            db
              .select()
              .from(eventParticipants)
              .where(
                and(
                  eq(eventParticipants.eventId, events.id),
                  eq(eventParticipants.userId, userId)
                )
              )
          )
        ),
      with: {
        eventParticipants: {
          where: eq(eventParticipants.userId, userId),
        },
        clan: true,
        bingos: true,
      },
      orderBy: events.createdAt,
    })

    if (userEvents.length === 0) return []

    const eventIds = userEvents.map((e) => e.id)

    // 1. Bulk Prize Pool Queries
    const buyInsResult = await db
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
      .groupBy(eventParticipants.eventId)

    const donationsResult = await db
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
      .groupBy(eventParticipants.eventId)

    const buyInsMap = new Map(buyInsResult.map((r) => [r.eventId, r.total]))
    const donationsMap = new Map(
      donationsResult.map((r) => [r.eventId, r.total])
    )

    // Identify which events the user manages
    const managedEventIds = userEvents
      .filter(
        (e) =>
          e.creatorId === userId ||
          e.eventParticipants[0]?.role === "admin" ||
          e.eventParticipants[0]?.role === "management"
      )
      .map((e) => e.id)

    // 2. Manager Data (if any managed events)
    const managerDataMap = new Map()
    if (managedEventIds.length > 0) {
      const pendingRegResult = await db
        .select({
          eventId: eventRegistrationRequests.eventId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(eventRegistrationRequests)
        .where(
          and(
            inArray(eventRegistrationRequests.eventId, managedEventIds),
            eq(eventRegistrationRequests.status, "pending")
          )
        )
        .groupBy(eventRegistrationRequests.eventId)

      const pendingSubResult = await db
        .select({
          eventId: teams.eventId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(submissions)
        .innerJoin(
          teamTileSubmissions,
          eq(submissions.teamTileSubmissionId, teamTileSubmissions.id)
        )
        .innerJoin(teams, eq(teamTileSubmissions.teamId, teams.id))
        .where(
          and(
            inArray(teams.eventId, managedEventIds),
            eq(submissions.status, "pending")
          )
        )
        .groupBy(teams.eventId)

      const totalPartResult = await db
        .select({
          eventId: eventParticipants.eventId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(eventParticipants)
        .where(inArray(eventParticipants.eventId, managedEventIds))
        .groupBy(eventParticipants.eventId)

      const activeTeamsResult = await db
        .select({
          eventId: teams.eventId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(teams)
        .where(inArray(teams.eventId, managedEventIds))
        .groupBy(teams.eventId)

      for (const id of managedEventIds) {
        managerDataMap.set(id, {
          actionItems: {
            pendingRegistrations:
              pendingRegResult.find((r) => r.eventId === id)?.count ?? 0,
            pendingSubmissions:
              pendingSubResult.find((r) => r.eventId === id)?.count ?? 0,
          },
          eventStats: {
            totalParticipants:
              totalPartResult.find((r) => r.eventId === id)?.count ?? 0,
            activeTeams:
              activeTeamsResult.find((r) => r.eventId === id)?.count ?? 0,
          },
        })
      }
    }

    // 3. Participant Data
    const participantDataMap = new Map()
    const userTeams = await db
      .select({
        eventId: teams.eventId,
        teamId: teams.id,
        teamName: teams.name,
      })
      .from(teamMembers)
      .innerJoin(teams, eq(teamMembers.teamId, teams.id))
      .where(
        and(inArray(teams.eventId, eventIds), eq(teamMembers.userId, userId))
      )

    const userTeamIds = userTeams.map((t) => t.teamId)
    let teamMemberCounts: { teamId: string; count: number }[] = []
    let completedTilesCount: { teamId: string; count: number }[] = []

    if (userTeamIds.length > 0) {
      teamMemberCounts = await db
        .select({
          teamId: teamMembers.teamId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(teamMembers)
        .where(inArray(teamMembers.teamId, userTeamIds))
        .groupBy(teamMembers.teamId)

      completedTilesCount = await db
        .select({
          teamId: teamTileSubmissions.teamId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(teamTileSubmissions)
        .where(
          and(
            inArray(teamTileSubmissions.teamId, userTeamIds),
            eq(teamTileSubmissions.status, "completed")
          )
        )
        .groupBy(teamTileSubmissions.teamId)
    }

    const bingoIds = userEvents.flatMap((e) => e.bingos?.map((b) => b.id) ?? [])

    let tilesCountMap = new Map()
    if (bingoIds.length > 0) {
      const bingoTotalTilesResult = await db
        .select({
          bingoId: tiles.bingoId,
          count: sql<number>`count(*)`.mapWith(Number),
        })
        .from(tiles)
        .where(inArray(tiles.bingoId, bingoIds))
        .groupBy(tiles.bingoId)

      tilesCountMap = new Map(
        bingoTotalTilesResult.map((r) => [r.bingoId, r.count])
      )
    }

    for (const t of userTeams) {
      const memberCount =
        teamMemberCounts.find((r) => r.teamId === t.teamId)?.count ?? 0
      const completedTiles =
        completedTilesCount.find((r) => r.teamId === t.teamId)?.count ?? 0

      const teamEvent = userEvents.find((e) => e.id === t.eventId)
      const isManager =
        teamEvent?.creatorId === userId ||
        teamEvent?.eventParticipants[0]?.role === "admin" ||
        teamEvent?.eventParticipants[0]?.role === "management"
      // Progress counts completions across every Board, so the total must too
      // (hidden Boards only count for managers).
      const totalTiles = (teamEvent?.bingos ?? [])
        .filter((b) => isManager || b.visible)
        .reduce((sum, b) => sum + (tilesCountMap.get(b.id) ?? 0), 0)

      participantDataMap.set(t.eventId, {
        team: {
          id: t.teamId,
          name: t.teamName,
          memberCount,
        },
        progress: {
          completedTiles,
          totalTiles,
        },
      })
    }

    const eventData = userEvents.map((event) => {
      const role =
        event.creatorId === userId
          ? "admin"
          : (event.eventParticipants[0]?.role ?? "participant")

      const basePrizePool = event.basePrizePool
      const totalBuyIns = buyInsMap.get(event.id) ?? 0
      const totalDonations = donationsMap.get(event.id) ?? 0
      const totalPrizePool = basePrizePool + totalBuyIns + totalDonations

      const isManager = role === "admin" || role === "management"

      return {
        event: {
          ...event,
          role,
        },
        totalPrizePool,
        ...(isManager && managerDataMap.has(event.id)
          ? { managerData: managerDataMap.get(event.id) }
          : {}),
        participantData: participantDataMap.get(event.id) ?? undefined,
      }
    })

    return eventData
  } catch (error) {
    logger.error({ error }, "Error fetching events")
    console.error("ACTUAL ERROR IN GETEVENTS:", error)
    throw new Error(
      `Failed to fetch events: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
