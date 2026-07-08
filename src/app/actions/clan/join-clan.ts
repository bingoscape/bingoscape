"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { and, eq } from "drizzle-orm"

const schema = z.object({
  inviteCode: z.string(),
  isMain: z.boolean().default(false),
})

export const joinClan = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: { inviteCode, isMain }, ctx: { user } }) => {
    try {
      return await db.transaction(async (tx) => {
        const invite = await tx.query.clanInvites.findFirst({
          where: eq(clanInvites.inviteCode, inviteCode),
        })

        if (!invite || !invite.isActive) {
          return {
            success: false as const,
            error: "Invalid or inactive invite code",
          }
        }

        if (invite.expiresAt && new Date() > invite.expiresAt) {
          return { success: false as const, error: "Invite code has expired" }
        }

        if (invite.maxUses && invite.currentUses >= invite.maxUses) {
          return {
            success: false as const,
            error: "Invite code has reached its maximum uses",
          }
        }

        const existingMembership = await tx.query.clanMembers.findFirst({
          where: and(
            eq(clanMembers.clanId, invite.clanId),
            eq(clanMembers.userId, user.id)
          ),
        })

        if (existingMembership) {
          return {
            success: false as const,
            error: "You are already a member of this clan",
          }
        }

        if (isMain) {
          const existingMainClan = await tx
            .select()
            .from(clanMembers)
            .where(
              and(eq(clanMembers.userId, user.id), eq(clanMembers.isMain, true))
            )
            .limit(1)

          if (existingMainClan.length > 0) {
            return {
              success: false as const,
              error: "You already have a main clan",
            }
          }
        }

        await tx.insert(clanMembers).values({
          clanId: invite.clanId,
          userId: user.id,
          isMain,
        })

        await tx
          .update(clanInvites)
          .set({
            currentUses: invite.currentUses + 1,
            isActive:
              invite.maxUses && invite.currentUses + 1 >= invite.maxUses
                ? false
                : invite.isActive,
          })
          .where(eq(clanInvites.id, invite.id))

        return { success: true as const, clanId: invite.clanId }
      })
    } catch (error) {
      return {
        success: false as const,
        error: error instanceof Error ? error.message : "Failed to join clan",
      }
    }
  })
