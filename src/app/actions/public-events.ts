"use server"

import { db } from "@/server/db"
import { events, bingos } from "@/server/db/schema"
import { eq, and, count } from "drizzle-orm"
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

