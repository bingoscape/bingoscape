'use server'

import { getServerAuthSession } from "@/server/auth"
import { db } from "@/server/db"
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"

export async function linkRunescapeAccount(runescapeName: string) {
  const session = await getServerAuthSession()
  if (!session || !session.user) {
    throw new Error("Not authenticated")
  }

  await db.update(users)
    .set({ runescapeName })
    .where(eq(users.id, session.user.id))

  return { success: true }
}
