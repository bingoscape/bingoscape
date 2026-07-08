"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, users } from "@/server/db/schema"
import { eq, sql } from "drizzle-orm"

const schema = z.object({
  clanId: z.string()
})

export const getClanMembers = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { clanId }, ctx: { user } }) => {
    try {
      const members = await db
        .select({
          id: users.id,
          name: users.name,
          runescapeName: users.runescapeName,
          image: users.image,
          role: clanMembers.role,
        })
        .from(clanMembers)
        .innerJoin(users, eq(clanMembers.userId, user.id))
        .where(eq(clanMembers.clanId, clanId))
        .orderBy(
          sql`CASE
            WHEN ${clanMembers.role} = 'admin' THEN 1
            WHEN ${clanMembers.role} = 'management' THEN 2
            WHEN ${clanMembers.role} = 'member' THEN 3
            WHEN ${clanMembers.role} = 'guest' THEN 4
            ELSE 5
          END`
        )

      return { success: true as const, members }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to get clan members" }
    }
  })
