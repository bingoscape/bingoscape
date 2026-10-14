"use server"

import { db } from "@/server/db"
import { notifications } from "@/server/db/schema"
import { eq, and, desc } from "drizzle-orm"
import { events, teams, tiles } from "@/server/db/schema"
import { getServerAuthSession } from "@/server/auth"
import { failure, type ActionResult } from "@/server/authz"

export async function getNotifications(userId: string, limit = 10) {
  // Notifications carry Tile titles: only the signed-in user may read their own.
  // Deliberate: a denial reads as an empty list (see guards.ts).
  const session = await getServerAuthSession()
  if (!session?.user || session.user.id !== userId) return []

  return db
    .select({
      id: notifications.id,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      eventTitle: events.title,
      eventId: events.id,
      teamName: teams.name,
      tileTitle: tiles.title,
      tileImage: tiles.headerImage,
    })
    .from(notifications)
    .innerJoin(events, eq(events.id, notifications.eventId))
    .innerJoin(teams, eq(teams.id, notifications.teamId))
    .innerJoin(tiles, eq(tiles.id, notifications.tileId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<ActionResult> {
  // Only the owner of a notification may mark it as read.
  const session = await getServerAuthSession()
  if (!session?.user) return failure("Unauthorized", "UNAUTHENTICATED")

  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.id, notificationId),
        eq(notifications.userId, session.user.id)
      )
    )
  return { success: true }
}
