'use server'

import { db } from "@/server/db"
import { logger } from "@/lib/logger";
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"

export async function updateProfile(formData: FormData) {
  const id = formData.get('id') as string
  const runescapeName = formData.get('runescapeName') as string

  if (!id) {
    return { success: false, error: "User ID is required" }
  }

  try {
    await db.update(users)
      .set({
        runescapeName: runescapeName || null,
      })
      .where(eq(users.id, id))

    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error updating profile:", error)
    return { success: false, error: "Failed to update profile" }
  }
}
