"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  clanId: z.string(),
  memberId: z.string(),
  newRole: z.enum(["admin", "management", "member", "guest"]),
})

export const updateMemberRole = authActionClient
  .schema(schema)
  .action(
    async ({ parsedInput: { clanId, memberId, newRole }, ctx: { user } }) => {
      try {
        const currentMembership = await db.query.clanMembers.findFirst({
          where: and(
            eq(clanMembers.clanId, clanId),
            eq(clanMembers.userId, user.id)
          ),
        })

        if (
          !currentMembership ||
          !["admin", "management"].includes(currentMembership.role)
        ) {
          return {
            success: false as const,
            error: "You don't have permission to update member roles",
          }
        }

        await db
          .update(clanMembers)
          .set({ role: newRole })
          .where(
            and(
              eq(clanMembers.clanId, clanId),
              eq(clanMembers.userId, memberId)
            )
          )

        return { success: true as const }
      } catch (error) {
        return {
          success: false as const,
          error:
            error instanceof Error
              ? error.message
              : "Failed to update member role",
        }
      }
    }
  )
