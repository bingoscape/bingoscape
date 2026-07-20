"use server"

import { db } from "@/server/db"
import { logger } from "@/lib/logger"
import { users } from "@/server/db/schema"
import { eq } from "drizzle-orm"
import { authenticatedAction } from "@/lib/safe-action"
import { z } from "zod"

const updateProfileSchema = z.object({
  id: z.string(),
  runescapeName: z.string()
    .max(12, "Runescape name must be at most 12 characters")
    .regex(/^[a-zA-Z0-9 ]*$/, "Runescape name must only contain alphanumeric characters and spaces")
    .nullable()
    .optional()
    .transform(val => val === "" ? null : val),
})

export const updateProfile = authenticatedAction
  .schema(updateProfileSchema)
  .action(async ({ parsedInput: { id, runescapeName }, ctx: { user } }) => {
    // Ensure the user is only updating their own profile
    if (user.id !== id) {
      throw new Error("Unauthorized to update this profile")
    }

    try {
      await db
        .update(users)
        .set({
          runescapeName: runescapeName || null,
        })
        .where(eq(users.id, id))

      return { success: true }
    } catch (error) {
      logger.error({ error }, "Error updating profile:", error)
      throw new Error("Failed to update profile")
    }
  })
