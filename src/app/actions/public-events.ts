"use server"

import { db } from "@/server/db"
import { events, bingos, teams, teamTileSubmissions, tiles } from "@/server/db/schema"
import { eq, and, count, inArray } from "drizzle-orm"
import type { UUID } from "crypto"

export interface PublicEventData {
  id: string
  title: string
  description: string | null
  startDate: Date
  endDate: Date
  clanName: string | null
  bingoCount: number
  basePrizePool: number
  minimumBuyIn: number
}

export interface PublicTeamData {
  id: string
  name: string
  completedTiles: string[] // Array of tile IDs that the team has completed
  inProgressTiles: string[] // Array of tile IDs that are in progress (pending, requires_interaction, declined)
}

/**
 * Fetch public event data by ID or share code
 * Only returns events that are marked as public
 */
export async function getPublicEvent(eventId: string): Promise<PublicEventData | null> {
  try {
    // First get the event
    const eventResult = await db.query.events.findFirst({
      where: and(
        eq(events.id, eventId as UUID),
        eq(events.public, true), // Only return public events
      ),
      with: {
        clan: true,
      },
    })

    if (!eventResult) {
      return null
    }

    // Count visible bingos separately
    const bingoCountResult = await db
      .select({ count: count() })
      .from(bingos)
      .where(and(eq(bingos.eventId, eventId as UUID), eq(bingos.visible, true)))

    const bingoCount = bingoCountResult[0]?.count ?? 0

    // Format the result
    return {
      id: eventResult.id,
      title: eventResult.title,
      description: eventResult.description,
      startDate: eventResult.startDate,
      endDate: eventResult.endDate,
      basePrizePool: eventResult.basePrizePool,
      minimumBuyIn: eventResult.minimumBuyIn,
      clanName: eventResult.clan?.name ?? null,
      bingoCount: Number(bingoCount),
    }
  } catch (error) {
    console.error("Error fetching public event:", error)
    return null
  }
}

/**
 * Fetch public bingos for an event
 * Only returns bingos that are marked as public
 */
export async function getPublicBingos(eventId: string) {
  try {
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
          eq(bingos.visible, true), // Only return public bingos
        ),
      )
      .execute()

    return result
  } catch (error) {
    console.error("Error fetching public bingos:", error)
    return []
  }
}

/**
 * Fetch public teams for an event and specific bingo board
 * Returns all teams participating in the event with their progress on the specified bingo board
 */
export async function getPublicTeams(eventId: string, bingoId: string): Promise<PublicTeamData[]> {
  try {
    const eventTeams = await db.query.teams.findMany({
      where: eq(teams.eventId, eventId as UUID),
      columns: {
        id: true,
        name: true,
      },
    })

    // Get all tile IDs for this bingo board
    const bingoTiles = await db
      .select({
        id: tiles.id,
      })
      .from(tiles)
      .where(eq(tiles.bingoId, bingoId as UUID))

    const bingoTileIds = bingoTiles.map((tile) => tile.id)

    const result: PublicTeamData[] = []

    // For each team, get their completed and in-progress tiles for this specific bingo board
    for (const team of eventTeams) {
      // Get completed tiles (status = "accepted") for this bingo board
      const completedTileSubmissions = await db
        .select({
          tileId: teamTileSubmissions.tileId,
        })
        .from(teamTileSubmissions)
        .where(
          and(
            eq(teamTileSubmissions.teamId, team.id),
            eq(teamTileSubmissions.status, "accepted"),
            inArray(teamTileSubmissions.tileId, bingoTileIds),
          ),
        )

      // Get in-progress tiles (status = "pending", "requires_interaction", or "declined") for this bingo board
      const inProgressTileSubmissions = await db
        .select({
          tileId: teamTileSubmissions.tileId,
        })
        .from(teamTileSubmissions)
        .where(
          and(
            eq(teamTileSubmissions.teamId, team.id),
            inArray(teamTileSubmissions.status, ["pending", "requires_interaction", "declined"]),
            inArray(teamTileSubmissions.tileId, bingoTileIds),
          ),
        )

      result.push({
        id: team.id,
        name: team.name,
        completedTiles: completedTileSubmissions.map((submission) => submission.tileId),
        inProgressTiles: inProgressTileSubmissions.map((submission) => submission.tileId),
      })
    }

    return result
  } catch (error) {
    console.error("Error fetching public teams:", error)
    return []
  }
}

/**
 * Get detailed public bingo data including tiles and their goals
 */
export async function getPublicBingoDetails(bingoId: string) {
  try {
    const bingo = await db.query.bingos.findFirst({
      where: and(eq(bingos.id, bingoId as UUID), eq(bingos.visible, true)),
    })

    if (!bingo) {
      return null
    }

    // Get visible tiles with their goals
    const bingoTiles = await db.query.tiles.findMany({
      where: and(eq(tiles.bingoId, bingoId as UUID), eq(tiles.isHidden, false)),
      with: {
        goals: true,
      },
    })

    return {
      ...bingo,
      tiles: bingoTiles,
    }
  } catch (error) {
    console.error("Error fetching public bingo details:", error)
    return null
  }
}
