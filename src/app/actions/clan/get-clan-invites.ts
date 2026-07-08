"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  clanId: z.string()
})

export const getClanInvites = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { clanId }, ctx: { user } }) => {
    try {
      const membership = await db.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, clanId),
          eq(clanMembers.userId, user.id)
        ),
      })

      if (!membership || !["admin", "management"].includes(membership.role)) {
        return { success: false as const, error: "Not authorized to view invites" }
      }

      const invites = await db.query.clanInvites.findMany({
        where: eq(clanInvites.clanId, clanId),
        with: {
          creator: {
            columns: {
              id: true,
              name: true,
              runescapeName: true,
              image: true,
            },
          },
        },
        orderBy: (invites, { desc }) => [desc(invites.createdAt)],
      })

      return { success: true as const, invites }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to get clan invites" }
    }
  })
