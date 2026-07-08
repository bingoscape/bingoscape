"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clans, clanMembers } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

const schema = z.object({
  name: z.string(),
  description: z.string(),
})

export const createClan = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { name, description }, ctx: { user } }) => {
    try {
      const newClan = await db.transaction(async (tx) => {
        const existingMainClan = await tx
          .select()
          .from(clanMembers)
          .where(
            and(eq(clanMembers.userId, user.id), eq(clanMembers.isMain, true))
          )
          .limit(1)

        const isFirstClan = existingMainClan.length === 0

        const [clan] = await tx
          .insert(clans)
          .values({
            name,
            description,
            ownerId: user.id,
          })
          .returning()

        await tx.insert(clanMembers).values({
          clanId: clan!.id,
          userId: user.id,
          isMain: isFirstClan,
          role: "admin",
        })

        return clan
      })

      revalidatePath("/clans")
      return { success: true as const, clan: newClan }
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to create clan",
      }
    }
  })
