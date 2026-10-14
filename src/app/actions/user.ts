"use server"

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { logger } from "@/lib/logger"

export async function linkRunescapeAccount(runescapeName: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("Not authenticated")
  }

  await db
    .update(users)
    .set({ runescapeName })
    .where(eq(users.id, session.user.id))

  return { success: true }
}

/**
 * "Sign out everywhere": every session (JWT) issued before now stops working,
 * on every device, including the one that calls this. The client signs out
 * afterwards.
 */
export async function revokeAllSessions() {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false as const, error: "Unauthorized" }
  }

  try {
    await db.transaction((tx) =>
      tx
        .update(users)
        .set({ sessionRevokedAt: new Date() })
        .where(eq(users.id, session.user.id))
    )
    return { success: true as const }
  } catch (error) {
    logger.error({ error }, "Error revoking sessions")
    return { success: false as const, error: "Failed to sign out everywhere" }
  }
}
