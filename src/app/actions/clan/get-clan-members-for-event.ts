"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, users, events, eventParticipants } from "@/server/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { getUserRole } from "../events"

const schema = z.object({
  eventId: z.string()
})

export const getClanMembersForEvent = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { eventId }, ctx: { user } }) => {
    try {
      const userRole = await getUserRole(eventId)
      if (!userRole || !["admin", "management"].includes(userRole)) {
        return { success: false as const, error: "Not authorized to manage event participants" }
      }

      const event = await db.query.events.findFirst({
        where: eq(events.id, eventId),
        columns: {
          id: true,
          clanId: true,
        },
      })

      if (!event) {
        return { success: false as const, error: "Event not found" }
      }

      if (!event.clanId) {
        return { success: false as const, error: "Event is not associated with a clan" }
      }

      const availableMembers = await db
        .select({
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
          image: users.image,
          role: clanMembers.role,
        })
        .from(clanMembers)
        .innerJoin(users, eq(clanMembers.userId, users.id))
        .where(
          and(
            eq(clanMembers.userId, user.id),
            sql`${users.id} NOT IN (
              SELECT ${eventParticipants.userId}
              FROM ${eventParticipants}
              WHERE ${eventParticipants.eventId} = ${eventId}
            )`
          )
        )
        .orderBy(
          sql`CASE
            WHEN ${clanMembers.role} = 'admin' THEN 1
            WHEN ${clanMembers.role} = 'management' THEN 2
            WHEN ${clanMembers.role} = 'member' THEN 3
            WHEN ${clanMembers.role} = 'guest' THEN 4
            ELSE 5
          END`
        )

      return { success: true as const, availableMembers }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to get clan members for event" }
    }
  })
