"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clans, clanMembers } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  clanId: z.string()
})

export const leaveClan = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { clanId }, ctx: { user } }) => {
    try {
      const clan = await db
        .select()
        .from(clans)
        .where(eq(clans.id, clanId))
        .limit(1)
        
      if (clan.length === 0) {
        return { success: false as const, error: "Clan not found" }
      }
        
      if (clan[0]!.ownerId === user.id) {
        return { success: false as const, error: "Clan owner cannot leave the clan" }
      }

      await db
        .delete(clanMembers)
        .where(
          and(
            eq(clanMembers.clanId, clanId),
            eq(clanMembers.userId, user.id)
          )
        )

      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to leave clan" }
    }
  })
