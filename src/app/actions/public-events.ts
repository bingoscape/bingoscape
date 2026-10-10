"use server"

import { db } from "@/server/db"
import { events, bingos, teams, tiles, clans } from "@/server/db/schema"
import { eq, and, count, asc } from "drizzle-orm"
import type { UUID } from "crypto"
import { logger } from "@/lib/logger"
import { redactHiddenTiles } from "@/lib/hidden-tiles"
import type { Bingo, Team, Tile } from "@/types/model"

/**
 * Public (unauthenticated) read access. Every function first checks that the
 * Event is marked public; Boards must additionally be visible. Hidden Tiles
 * keep their cell but are redacted, and secrets (codephrase, tracker
 * verification code) never leave the server.
 */

export interface PublicEventData {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  timezone: string
  gameType: "osrs" | "rs3"
  locked: boolean
  registrationDeadline: Date | null
  clanName: string | null
  bingoCount: number
  basePrizePool: number
  minimumBuyIn: number
}

async function isPublicEvent(eventId: string): Promise<boolean> {
  const event = await db.query.events.findFirst({
    where: and(eq(events.id, eventId as UUID), eq(events.public, true)),
    columns: { id: true },
  })
  return !!event
}

/** Board row without anything a public viewer must not see. */
function sanitizeBingo<T extends Bingo>(bingo: T): T {
  return {
    ...bingo,
    codephrase: "",
    womCompetitionId: null,
    womVerificationCode: null,
  }
}

/**
 * Fetch public event data by ID or share code
 * Only returns events that are marked as public
 */
export async function getPublicEvent(
  eventId: string
): Promise<PublicEventData | null> {
  try {
    // First get the event
    const eventResult = await db.query.events.findFirst({
      where: and(
        eq(events.id, eventId as UUID),
        eq(events.public, true) // Only return public events
      ),
    })

    if (!eventResult) {
      return null
    }

    const bingoCountResult = await db
      .select({ count: count() })
      .from(bingos)
      .where(and(eq(bingos.eventId, eventId as UUID), eq(bingos.visible, true)))

    const bingoCount = bingoCountResult[0]?.count ?? 0
    const clanName = await getClanName(eventResult.clanId)

    // Format the result
    return {
      id: eventResult.id,
      title: eventResult.title,
      description: eventResult.description,
      startDate: eventResult.startDate,
      endDate: eventResult.endDate,
      timezone: eventResult.timezone,
      gameType: eventResult.gameType,
      locked: eventResult.locked,
      registrationDeadline: eventResult.registrationDeadline,
      basePrizePool: eventResult.basePrizePool,
      minimumBuyIn: eventResult.minimumBuyIn,
      clanName: clanName,
      bingoCount: Number(bingoCount),
    }
  } catch (error) {
    logger.error({ error }, "Error fetching public event:", error)
    return null
  }
}

async function getClanName(clanId: string | null): Promise<string | null> {
  if (!clanId) return null
  const clan = await db.query.clans.findFirst({
    where: eq(clans.id, clanId),
  })
  return clan?.name ?? null
}

/**
 * Fetch public bingos for an event
 * Only returns bingos that are marked as public
 */
export async function getPublicBingos(eventId: string) {
  try {
    if (!(await isPublicEvent(eventId))) return []

    const result = await db
      .select({
        id: bingos.id,
        title: bingos.title,
        description: bingos.description,
        rows: bingos.rows,
        columns: bingos.columns,
      })
      .from(bingos)
      .where(
        and(
          eq(bingos.eventId, eventId as UUID),
          eq(bingos.visible, true) // Only return public bingos
        )
      )
      .execute()

    return result
  } catch (error) {
    logger.error({ error, eventId }, "Error fetching public bingos")
    return []
  }
}

/**
 * Get public bingo data including tiles and their goals. Hidden Tiles are
 * kept (so the grid geometry is right) but redacted.
 */
export async function getPublicBingoDetails(bingoId: string) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: and(eq(bingos.id, bingoId as UUID), eq(bingos.visible, true)),
    })

    if (!bingo || !(await isPublicEvent(bingo.eventId))) {
      return null
    }

    const bingoTiles = await db.query.tiles.findMany({
      where: eq(tiles.bingoId, bingoId as UUID),
      orderBy: [asc(tiles.index)],
      with: {
        goals: true,
      },
    })

    return {
      ...sanitizeBingo(bingo),
      tiles: redactHiddenTiles(bingoTiles),
    }
  } catch (error) {
    logger.error({ error, bingoId }, "Error fetching public bingo details")
    return null
  }
}

export interface PublicWorkspaceData {
  /** All visible Boards; only the active one carries its Tiles. */
  bingos: Bingo[]
  teams: Team[]
}

/**
 * Everything the read-only Event workspace needs for `/public/events/[id]`:
 * the visible Boards (the one picked by `board`, else the first, with its
 * Tiles, Goals and Teams' progress) and the Event's Teams. Teams' Tile status
 * is reduced to "completed" / "in progress": no images, users or reviewers.
 */
export async function getPublicWorkspaceData(
  eventId: string,
  board: string | null
): Promise<PublicWorkspaceData | null> {
  try {
    if (!(await isPublicEvent(eventId))) return null

    const [boards, eventTeams] = await Promise.all([
      db.query.bingos.findMany({
        where: and(
          eq(bingos.eventId, eventId as UUID),
          eq(bingos.visible, true)
        ),
        orderBy: [asc(bingos.createdAt)],
      }),
      db.query.teams.findMany({
        where: eq(teams.eventId, eventId as UUID),
        orderBy: [asc(teams.name)],
      }),
    ])

    const safeBoards: Bingo[] = boards.map((b) => ({
      ...sanitizeBingo(b),
      tiles: [],
    }))
    const active = safeBoards.find((b) => b.id === board) ?? safeBoards[0]

    if (active) {
      const teamById = new Map(eventTeams.map((t) => [t.id, t]))
      const rows = await db.query.tiles.findMany({
        where: eq(tiles.bingoId, active.id as UUID),
        orderBy: [asc(tiles.index)],
        with: {
          goals: {
            with: {
              teamProgress: true,
              goalValues: true,
              itemGoal: true,
              metricGoal: true,
            },
          },
          goalGroups: true,
          teamTileSubmissions: true,
        },
      })

      const publicTiles: Tile[] = rows.map((row) => ({
        ...row,
        teamTileSubmissions: row.teamTileSubmissions.flatMap((tts) => {
          const team = teamById.get(tts.teamId)
          if (!team) return []
          // A Team with activity on a Tile that is not completed is "in
          // progress". The workspace derives that from a Submission state, so
          // hand it a state-only placeholder: the real Submissions (images,
          // users) are never loaded for the public view.
          const placeholder = [{ status: "approved" }] as unknown as NonNullable<
            Tile["teamTileSubmissions"]
          >[number]["submissions"]
          return [
            {
              ...tts,
              reviewedBy: null,
              team,
              submissions: tts.status === "completed" ? [] : placeholder,
            },
          ]
        }),
      }))

      active.tiles = redactHiddenTiles(publicTiles)
    }

    return { bingos: safeBoards, teams: eventTeams }
  } catch (error) {
    logger.error({ error, eventId }, "Error fetching public workspace data")
    return null
  }
}
