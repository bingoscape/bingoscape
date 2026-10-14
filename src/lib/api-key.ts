import { createHash } from "node:crypto"

import { nanoid } from "nanoid"

/** Every API key starts with this, so leaked keys are easy to recognise. */
export const API_KEY_PREFIX = "bsn_"

/** Characters of the key kept (unhashed) so the owner can tell keys apart. */
export const API_KEY_DISPLAY_PREFIX_LENGTH = 8

/**
 * What an API key may do.
 * - `read`   the RuneLite read routes (events, boards, feeds, key check, item check)
 * - `submit` uploading (auto-)submissions
 */
export const API_KEY_SCOPES = ["read", "submit"] as const
export type ApiKeyScope = (typeof API_KEY_SCOPES)[number]

/** The scopes of a key created without an explicit choice (and of every legacy key). */
export const DEFAULT_API_KEY_SCOPES: readonly ApiKeyScope[] = API_KEY_SCOPES

/** Lower-case hex SHA-256 of the key's UTF-8 bytes (what migration 0040 backfills). */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key, "utf8").digest("hex")
}

export function apiKeyDisplayPrefix(key: string): string {
  return key.slice(0, API_KEY_DISPLAY_PREFIX_LENGTH)
}

/** A fresh key with its hash and prefix. Only the hash and prefix are stored. */
export function generateApiKey(): { key: string; hash: string; prefix: string } {
  const key = `${API_KEY_PREFIX}${nanoid(32)}`
  return { key, hash: hashApiKey(key), prefix: apiKeyDisplayPrefix(key) }
}

export function isApiKeyScope(value: string): value is ApiKeyScope {
  return (API_KEY_SCOPES as readonly string[]).includes(value)
}

export function hasApiKeyScope(
  scopes: readonly string[] | null | undefined,
  scope: ApiKeyScope
): boolean {
  return !!scopes && scopes.includes(scope)
}

export type ApiKeyStatus = "active" | "revoked" | "expired"

export function apiKeyStatus(
  key: { revokedAt: Date | null; expiresAt: Date | null },
  now: Date = new Date()
): ApiKeyStatus {
  if (key.revokedAt) return "revoked"
  if (key.expiresAt && key.expiresAt <= now) return "expired"
  return "active"
}
