"use server"

import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"
import { eq, and } from "drizzle-orm"
import { getServerAuthSession } from "@/server/auth"
import { z } from "zod"
import { revalidatePath } from "next/cache"
import { logger } from "@/lib/logger"
import { createApiKeyForUser, revokeApiKeyForUser } from "@/server/api-keys"

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  // Days until the key expires; empty / missing means it never expires.
  expiresInDays: z.coerce.number().int().min(1).max(3650).optional(),
  // A read-only key cannot upload submissions.
  readOnly: z.boolean().default(false),
})

type CreateApiKeyState = {
  success: boolean
  error?: string
  key?: {
    id: string
    name: string
    description: string | null
    createdAt: Date
    keyPrefix: string
    /** The plaintext key, returned this once and never stored. */
    key: string
  }
} | null

export async function createApiKey(
  prevState: CreateApiKeyState,
  formData: FormData
): Promise<NonNullable<CreateApiKeyState>> {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const expiresRaw = formData.get("expiresInDays")
    const { name, description, expiresInDays, readOnly } = createSchema.parse({
      name: formData.get("name"),
      description: formData.get("description") ?? undefined,
      expiresInDays: expiresRaw ? expiresRaw : undefined,
      readOnly: formData.get("readOnly") === "on",
    })

    const created = await createApiKeyForUser(session.user.id, {
      name,
      description: description || null,
      scopes: readOnly ? ["read"] : ["read", "submit"],
      expiresAt: expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null,
    })

    revalidatePath("/profile/api-keys")
    revalidatePath("/profile")
    return {
      success: true,
      key: {
        id: created.id,
        name: created.name,
        description: created.description,
        createdAt: created.createdAt,
        keyPrefix: created.keyPrefix,
        key: created.key,
      },
    }
  } catch (error) {
    logger.error({ error }, "Error creating API key:", error)
    if (error instanceof z.ZodError) {
      return { success: false, error: "Invalid request data" }
    }
    return { success: false, error: "Failed to create API key" }
  }
}

/** Revokes a key: it stops working at once but stays in the list. */
export async function revokeApiKey(id: string) {
  const session = await getServerAuthSession()
  if (!session?.user) {
    return { success: false, error: "Unauthorized" }
  }

  try {
    const revoked = await revokeApiKeyForUser(session.user.id, id)
    if (!revoked) return { success: false, error: "API key not found" }

    revalidatePath("/profile/api-keys")
    return { success: true }
  } catch (error) {
    logger.error({ error }, "Error revoking API key")
    return { success: false, error: "Failed to revoke API key" }
  }
}

/** Deletes a key for good (use `revokeApiKey` to keep the record). */
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
