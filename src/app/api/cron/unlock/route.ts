import { NextResponse } from "next/server"
import { db } from "@/server/db"
import { events, bingos } from "@/server/db/schema"
import { eq, and, lte, or, inArray, isNull } from "drizzle-orm"

export const dynamic = "force-dynamic" // Ensure this is not cached

export async function GET(request: Request) {
  try {
    // 1. Verify authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const now = new Date()

    // 2. Find events to unlock
    const eventsToUnlock = await db.query.events.findMany({
      where: and(
        eq(events.locked, true),
        lte(events.startDate, now)
      ),
      columns: {
        id: true,
      },
    })

    const eventIdsToUnlock = eventsToUnlock.map((e) => e.id)

    // 3. Unlock events
    if (eventIdsToUnlock.length > 0) {
      await db
        .update(events)
        .set({
          locked: false,
          public: true,
        })
        .where(inArray(events.id, eventIdsToUnlock))
    }

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
        eq(bingos.locked, true),
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
      await db
        .update(bingos)
        .set({
          locked: false,
          visible: true,
        })
        .where(inArray(bingos.id, bingoIdsToUnlock))
    }

    return NextResponse.json({
      success: true,
      eventsUnlocked: eventIdsToUnlock.length,
      bingosUnlocked: bingoIdsToUnlock.length,
    })
  } catch (error) {
    console.error("Error in cron unlock route:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
