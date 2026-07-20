"use server"

import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { nanoid } from "nanoid"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})

type CreateApiKeyState = {
  success: boolean;
  error?: string;
  key?: {
    id: string;
    name: string;
    description: string | null;
    createdAt: Date;
    key: string;
  };
} | null;

export async function createApiKey(prevState: CreateApiKeyState, formData: FormData) {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const rawData = {
      name: formData.get("name") as string,
      description: formData.get("description") as string,
    }
    const { name, description } = createSchema.parse(rawData)
    const key = `bsn_${nanoid(32)}`

    const newKey = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(apiKeys)
        .values({
          userId: session.user.id,
          name,
          description: description || null,
          key,
          lastUsed: null,
        })
        .returning({
          id: apiKeys.id,
          name: apiKeys.name,
          description: apiKeys.description,
          createdAt: apiKeys.createdAt,
          key: apiKeys.key,
        })
      return inserted
    })

    revalidatePath("/profile/api-keys")
    revalidatePath("/profile")
    return { success: true, key: newKey }
  } catch (error) {
    logger.error({ error }, "Error creating API key:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid request data" }
    }
    return { success: false, error: "Failed to create API key" }
  }
}

export async function deleteApiKey(id: string) {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    await db.transaction(async (tx) => {
      const [deletedKey] = await tx
        .delete(apiKeys)
        .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, session.user.id)))
        .returning({ id: apiKeys.id })

      if (!deletedKey) {
        throw new Error("API key not found")
      }
    })

    revalidatePath("/profile/api-keys")
    revalidatePath("/profile")
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error deleting API key")
    return { success: false, error: "Failed to delete API key" }
  }
}
