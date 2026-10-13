import { and, eq, or } from "drizzle-orm"

import { db } from "@/server/db"
import { eventParticipants, notifications } from "@/server/db/schema"

/**
 * Notifies every admin and management member of the Event.
 *
 * Intentionally not a "use server" module: it is called by other server code
 * after that code authorized the caller, and must not be callable from the
 * client.
 */
export async function createNotification(
  eventId: string,
  tileId: string,
  teamId: string,
  message: string
) {
  // Get all admin and management users for the event
  const usersToNotify = await db
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        or(
          eq(eventParticipants.role, "admin"),
          eq(eventParticipants.role, "management")
        )
      )
    )

  // Create notifications for each admin/management user
  for (const user of usersToNotify) {
    await db.insert(notifications).values({
      userId: user.userId,
      eventId,
      tileId,
      teamId,
      message,
    })
  }
}
