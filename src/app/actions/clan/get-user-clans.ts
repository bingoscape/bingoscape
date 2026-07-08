"use server"

import { authenticatedAction as authActionClient } from "@/lib/safe-action"
import { z } from "zod"
import { db } from "@/server/db"
import { clans, clanMembers, users } from "@/server/db/schema"
import { eq, sql } from "drizzle-orm"

const schema = z.object({}) // No arguments

export const getUserClans = authActionClient
  .schema(schema)
  .action(async ({ ctx: { user } }) => {
    try {
      const userClans = await db
        .select({
          clan: clans,
          isMain: clanMembers.isMain,
          owner: users,
          memberCount: sql<number>`(
            SELECT COUNT(*)
            FROM ${clanMembers} AS cm
            WHERE cm.clan_id = ${clans.id}
          )`.as("memberCount"),
        })
        .from(clans)
        .innerJoin(clanMembers, eq(clans.id, clanMembers.clanId))
        .innerJoin(users, eq(users.id, clans.ownerId))
        .where(eq(clanMembers.userId, user.id))
        .groupBy(clans.id, clanMembers.isMain, users.id)

      return { success: true as const, userClans }
    } catch (error) {
      return { success: false as const, error: error instanceof Error ? error.message : "Failed to get user clans" }
    }
  })
