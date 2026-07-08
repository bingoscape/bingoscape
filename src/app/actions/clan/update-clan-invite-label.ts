"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  inviteId: z.string(),
  label: z.string()
})

export const updateClanInviteLabel = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { inviteId, label }, ctx: { user } }) => {
    try {
      const invite = await db.query.clanInvites.findFirst({
        where: eq(clanInvites.id, inviteId),
        with: { clan: true },
      })

      if (!invite) {
        return { success: false as const, error: "Invite not found" }
      }

      const membership = await db.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, invite.clanId),
          eq(clanMembers.userId, user.id)
        ),
      })

      if (!membership || !["admin", "management"].includes(membership.role)) {
        return { success: false as const, error: "Not authorized to update invites" }
      }

      await db
        .update(clanInvites)
        .set({
          label,
          updatedAt: new Date(),
        })
        .where(eq(clanInvites.id, inviteId))

      return { success: true as const }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to update clan invite label" }
    }
  })
