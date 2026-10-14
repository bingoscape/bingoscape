import "server-only"

import { and, eq, isNull } from "drizzle-orm"

import {
  DEFAULT_API_KEY_SCOPES,
  generateApiKey,
  type ApiKeyScope,
} from "@/lib/api-key"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"

/** Longest lifetime a client may ask for. Keys without an expiry stay allowed. */
export const MAX_API_KEY_LIFETIME_DAYS = 3650

export interface CreatedApiKey {
  id: string
  name: string
  description: string | null
  createdAt: Date
  keyPrefix: string
  scopes: string[]
  expiresAt: Date | null
  /** The plaintext key. Shown once; only its SHA-256 hash is stored. */
  key: string
}

/**
 * Creates an API key for a user and returns the plaintext once. The legacy
 * plaintext column stays NULL for new keys.
 */
export async function createApiKeyForUser(
  userId: string,
  input: {
    name: string
    description?: string | null
    scopes?: readonly ApiKeyScope[]
    expiresAt?: Date | null
  }
): Promise<CreatedApiKey> {
  const { key, hash, prefix } = generateApiKey()
  const scopes = [...(input.scopes ?? DEFAULT_API_KEY_SCOPES)]

  const [inserted] = await db.transaction((tx) =>
    tx
      .insert(apiKeys)
      .values({
        userId,
        name: input.name,
        description: input.description ?? null,
        keyHash: hash,
        keyPrefix: prefix,
        scopes,
        expiresAt: input.expiresAt ?? null,
        lastUsed: null,
      })
      .returning({
        id: apiKeys.id,
        name: apiKeys.name,
        description: apiKeys.description,
        createdAt: apiKeys.createdAt,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        expiresAt: apiKeys.expiresAt,
      })
  )
  if (!inserted) throw new Error("api_keys insert returned no row")
  return { ...inserted, keyPrefix: inserted.keyPrefix ?? prefix, key }
}

/** Revokes one of the user's keys. False when it does not exist or is not theirs. */
export async function revokeApiKeyForUser(
  userId: string,
  keyId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(apiKeys.id, keyId),
          eq(apiKeys.userId, userId),
          isNull(apiKeys.revokedAt)
        )
      )
      .returning({ id: apiKeys.id })
    if (row) return true
    // Already revoked counts as success for the owner.
    const [existing] = await tx
      .select({ id: apiKeys.id })
      .from(apiKeys)
      .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)))
      .limit(1)
    return !!existing
  })
}
