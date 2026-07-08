"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clanMembers, clanInvites } from "@/server/db/schema"
import { and, eq, count } from "drizzle-orm"
import { nanoid } from "nanoid"
import type { CreateClanInviteParams } from "@/types/clan"

const schema = z.object({
  clanId: z.string(),
  label: z.string().optional(),
  expiresInDays: z.number().nullable().optional(),
  maxUses: z.number().nullable().optional(),
})

export const createClanInvite = authActionClient
  .schema(schema)
  .action(async ({ parsedInput: params, ctx: { user } }) => {
    try {
      const membership = await db.query.clanMembers.findFirst({
        where: and(
          eq(clanMembers.clanId, params.clanId),
          eq(clanMembers.userId, user.id)
        ),
      })

      if (!membership || !["admin", "management"].includes(membership.role)) {
        return { success: false as const, error: "Not authorized to create invites" }
      }

      const activeInviteCount = await db
        .select({ count: count() })
        .from(clanInvites)
        .where(
          and(eq(clanInvites.clanId, params.clanId), eq(clanInvites.isActive, true))
        )

      if (activeInviteCount[0]!.count >= 50) {
        return { success: false as const, error: "Maximum active invite limit reached (50)" }
      }

      const inviteCode = nanoid(10)

      const expiresAt = params.expiresInDays
        ? new Date(Date.now() + params.expiresInDays * 24 * 60 * 60 * 1000)
        : null

      const [invite] = await db
        .insert(clanInvites)
        .values({
          clanId: params.clanId,
          inviteCode,
          expiresAt,
          createdBy: user.id,
          label: params.label ?? null,
          maxUses: params.maxUses ?? null,
          currentUses: 0,
          isActive: true,
        })
        .returning()

      return { success: true as const, invite }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to create clan invite" }
    }
  })
