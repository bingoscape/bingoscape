import { and, eq, isNull, lt, or } from "drizzle-orm"

import { logger } from "@/lib/logger"
import {
  apiKeyStatus,
  hasApiKeyScope,
  hashApiKey,
  type ApiKeyScope,
} from "@/lib/api-key"
import { db } from "@/server/db"
import { apiKeys } from "@/server/db/schema"

/** `apiKeys.lastUsed` is written at most this often per key. */
export const LAST_USED_THROTTLE_MS = 60_000

export interface AuthenticatedApiKey {
  keyId: string
  userId: string
  name: string
  scopes: string[]
}

/** Why a key was refused; callers answer 401 for all of them. */
export type ApiKeyRejection = "unknown" | "revoked" | "expired" | "scope"

export type ApiKeyCheck =
  | { ok: true; key: AuthenticatedApiKey }
  | { ok: false; reason: ApiKeyRejection }

const KEY_COLUMNS = {
  id: apiKeys.id,
  userId: apiKeys.userId,
  name: apiKeys.name,
  scopes: apiKeys.scopes,
  lastUsed: apiKeys.lastUsed,
  revokedAt: apiKeys.revokedAt,
  expiresAt: apiKeys.expiresAt,
} as const

/**
 * Checks a plaintext API key: looked up by its SHA-256 hash (the plaintext is
 * never stored), then revocation, expiry and the required scope are checked.
 * `lastUsed` is stamped at most once per throttle window.
 */
export async function checkApiKey(
  plaintext: string,
  options: { scope?: ApiKeyScope; now?: Date } = {}
): Promise<ApiKeyCheck> {
  const now = options.now ?? new Date()

  const [row] = await db
    .select(KEY_COLUMNS)
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hashApiKey(plaintext)))
    .limit(1)

  if (!row) return { ok: false, reason: "unknown" }

  const status = apiKeyStatus(row, now)
  if (status !== "active") return { ok: false, reason: status }
  if (options.scope && !hasApiKeyScope(row.scopes, options.scope)) {
    return { ok: false, reason: "scope" }
  }

  const cutoff = new Date(now.getTime() - LAST_USED_THROTTLE_MS)
  if (!row.lastUsed || row.lastUsed < cutoff) {
    // The guard in the WHERE keeps concurrent instances from all writing in
    // the same window.
    await db
      .update(apiKeys)
      .set({ lastUsed: now })
      .where(
        and(
          eq(apiKeys.id, row.id),
          or(isNull(apiKeys.lastUsed), lt(apiKeys.lastUsed, cutoff))
        )
      )
  }

  return {
    ok: true,
    key: {
      keyId: row.id,
      userId: row.userId,
      name: row.name,
      scopes: row.scopes,
    },
  }
}

/** The plaintext key of a `Authorization: Bearer <key>` header, or null. */
export function bearerKey(req: Request): string | null {
  const match = req.headers.get("Authorization")?.match(/^Bearer\s+(.+)$/)
  return match ? match[1]! : null
}

/**
 * Validates the API key of a request and returns the owner's user ID, or null
 * when there is no valid key (missing, unknown, revoked, expired, or without
 * the required scope). Without `scope` the `read` scope is required.
 */
export async function validateApiKey(
  req: Request,
  scope: ApiKeyScope = "read"
): Promise<string | null> {
  try {
    const apiKey = bearerKey(req)
    if (!apiKey) return null
    const check = await checkApiKey(apiKey, { scope })
    return check.ok ? check.key.userId : null
  } catch (error) {
    logger.error({ error }, "Error validating API key")
    return null
  }
}
