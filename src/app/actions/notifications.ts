"use server"

import { db } from "@/server/db"
import { notifications, eventParticipants } from "@/server/db/schema"
import { eq, and, desc, or } from "drizzle-orm"
import { events, teams, tiles } from "@/server/db/schema"

export async function createNotification(eventId: string, tileId: string, teamId: string, message: string) {
  // Get all admin and management users for the event
  const usersToNotify = await db
    .select({ userId: eventParticipants.userId })
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        or(eq(eventParticipants.role, "admin"), eq(eventParticipants.role, "management")),
      ),
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

export async function getNotifications(userId: string, limit = 10) {
  return db
    .select({
      id: notifications.id,
      message: notifications.message,
      isRead: notifications.isRead,
      createdAt: notifications.createdAt,
      eventTitle: events.title,
      teamName: teams.name,
      tileTitle: tiles.title,
    })
    .from(notifications)
    .innerJoin(events, eq(events.id, notifications.eventId))
    .innerJoin(teams, eq(teams.id, notifications.teamId))
    .innerJoin(tiles, eq(tiles.id, notifications.tileId))
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit)
}

export async function markNotificationAsRead(notificationId: string) {
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, notificationId))
}
