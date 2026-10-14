import { and, eq, isNull, lt, or } from "drizzle-orm"

import { logger } from "@/lib/logger"
import {
  apiKeyDisplayPrefix,
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
  keyHash: apiKeys.keyHash,
  revokedAt: apiKeys.revokedAt,
  expiresAt: apiKeys.expiresAt,
} as const

/**
 * Checks a plaintext API key.
 *
 * Lookup order (dual-read, for one release): by the SHA-256 hash first, then by
 * the legacy plaintext column for keys the previous app version created after
 * migration 0040. A legacy hit backfills the hash and prefix so the next call
 * takes the fast path. Revocation, expiry and the required scope are checked
 * on both paths. `lastUsed` is stamped at most once per throttle window.
 */
export async function checkApiKey(
  plaintext: string,
  options: { scope?: ApiKeyScope; now?: Date } = {}
): Promise<ApiKeyCheck> {
  const now = options.now ?? new Date()
  const hash = hashApiKey(plaintext)

  let [row] = await db
    .select(KEY_COLUMNS)
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, hash))
    .limit(1)
  let viaLegacyColumn = false

  if (!row) {
    // Legacy: a key created by the previous app version has no hash yet.
    const [legacy] = await db
      .select(KEY_COLUMNS)
      .from(apiKeys)
      .where(eq(apiKeys.key, plaintext))
      .limit(1)
    row = legacy
    viaLegacyColumn = !!legacy
  }

  if (!row) return { ok: false, reason: "unknown" }

  const status = apiKeyStatus(row, now)
  if (status !== "active") return { ok: false, reason: status }
  if (options.scope && !hasApiKeyScope(row.scopes, options.scope)) {
    return { ok: false, reason: "scope" }
  }

  const cutoff = new Date(now.getTime() - LAST_USED_THROTTLE_MS)
  const stale = !row.lastUsed || row.lastUsed < cutoff
  if (viaLegacyColumn || stale) {
    // The guard in the WHERE keeps concurrent instances from all writing in
    // the same window; a legacy row is backfilled regardless.
    const staleGuard = or(isNull(apiKeys.lastUsed), lt(apiKeys.lastUsed, cutoff))
    await db
      .update(apiKeys)
      .set({
        ...(stale ? { lastUsed: now } : {}),
        ...(viaLegacyColumn
          ? { keyHash: hash, keyPrefix: apiKeyDisplayPrefix(plaintext) }
          : {}),
      })
      .where(
        viaLegacyColumn
          ? eq(apiKeys.id, row.id)
          : and(eq(apiKeys.id, row.id), staleGuard)
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
