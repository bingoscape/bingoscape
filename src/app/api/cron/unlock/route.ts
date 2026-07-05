import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { events, bingos } from "@/server/db/schema"
import { eq, and, lte, or, inArray, isNull } from "drizzle-orm"
import { logger } from "@/lib/logger"

export const dynamic = "force-dynamic" // Ensure this is not cached

export async function GET(request: Request) {
  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      logger.warn("Unauthorized attempt to access cron unlock route")
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const now = new Date()

    // 2. Events do not need to be unlocked by cron (public/locked are managed manually)
    const eventIdsToUnlock: string[] = []

    // 4. Find bingos to unlock based on their own scheduled date OR event start date if null
    
    // Get currently unlocked events (including the ones we just unlocked)
    const unlockedEvents = await db.query.events.findMany({
      where: and(
        eq(events.locked, false),
        lte(events.startDate, now)
      ),
      columns: {
        id: true,
      },
    })
    const unlockedEventIds = unlockedEvents.map((e) => e.id)

    // Find bingos
    const bingosToUnlockQuery = await db.query.bingos.findMany({
      where: and(
        or(eq(bingos.locked, true), eq(bingos.visible, false)),
        or(
          lte(bingos.scheduledUnlockDate, now),
          unlockedEventIds.length > 0 
            ? and(isNull(bingos.scheduledUnlockDate), inArray(bingos.eventId, unlockedEventIds))
            : undefined
        )
      ),
      columns: {
        id: true,
      },
    })

    const bingoIdsToUnlock = bingosToUnlockQuery.map((b) => b.id)

    // 5. Unlock bingos
    if (bingoIdsToUnlock.length > 0) {
      logger.info({ bingoIds: bingoIdsToUnlock }, "Unlocking bingos")
      await db
        .update(bingos)
        .set({
          locked: false,
          visible: true,
        })
        .where(inArray(bingos.id, bingoIdsToUnlock))
    }
    
    logger.info({ eventsUnlocked: eventIdsToUnlock.length, bingosUnlocked: bingoIdsToUnlock.length }, "Cron unlock completed successfully")

    return NextResponse.json({
      success: true,
      eventsUnlocked: eventIdsToUnlock.length,
      bingosUnlocked: bingoIdsToUnlock.length,
    })
  } catch (error) {
      logger.error({ error }, "Error in cron unlock route")
      return new NextResponse("Internal Server Error", { status: 500 })
  }
}
