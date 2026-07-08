"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clans, clanMembers, events, users } from "@/server/db/schema"
import { and, eq, sql } from "drizzle-orm"

const schema = z.object({
  clanId: z.string()
})

export const getClanDetails = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { clanId }, ctx: { user } }) => {
    try {
      const userMembership = await db.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, clanId),
          eq(clanMembers.userId, user.id)
        ),
      })

      if (!userMembership) {
        return { success: false as const, error: "You are not a member of this clan" }
      }

      const clanDetailsQuery = await db
        .select({
          id: clans.id,
          name: clans.name,
          description: clans.description,
          ownerId: clans.ownerId,
        })
        .from(clans)
        .where(eq(clans.id, clanId))
        .limit(1)

      if (clanDetailsQuery.length === 0) {
        return { success: false as const, error: "Clan not found" }
      }

      const clanDetails = clanDetailsQuery[0]!

      const memberCountQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(clanMembers)
        .where(eq(clanMembers.clanId, clanId))

      const eventCountQuery = await db
        .select({ count: sql<number>`count(*)` })
        .from(events)
        .where(eq(events.clanId, clanId))

      const owner = await db.query.users.findFirst({
        where: eq(users.id, clanDetails.ownerId!),
        columns: {
          id: true,
          name: true,
          image: true,
          runescapeName: true,
        },
      })

      return { 
        success: true as const, 
        clanDetails: {
          ...clanDetails,
          memberCount: memberCountQuery[0]?.count ?? 0,
          eventCount: eventCountQuery[0]?.count ?? 0,
          userMembership,
          owner,
        }
      }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to get clan details" }
    }
  })
