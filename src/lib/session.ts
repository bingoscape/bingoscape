/**
 * Session (JWT) lifetime and revocation rules (RBAC 7/8, #190).
 *
 * The token is a signed cookie, so the server cannot delete it. Instead each
 * user row carries `session_revoked_at`: a token issued before that instant is
 * rejected, and so is a token whose user no longer exists.
 */

/** A session is valid for this long after sign-in (sliding, see the update age). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** The token is re-issued (and its expiry extended) at most this often. */
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60

/** Thrown from the NextAuth `jwt` callback; NextAuth then answers "no session". */
export class SessionInvalidError extends Error {
  constructor(message = "Session is no longer valid") {
    super(message)
    this.name = "SessionInvalidError"
  }
}

/**
 * True when a token issued at `issuedAtSeconds` (the JWT `iat` claim) predates
 * the user's `session_revoked_at`. A token without `iat` cannot be older than
 * anything and is treated as revoked once a revocation exists, which only
 * affects forged or malformed tokens (NextAuth always sets `iat`).
 */
export function isSessionRevoked(
  issuedAtSeconds: unknown,
  revokedAt: Date | null | undefined
): boolean {
  if (!revokedAt) return false
  if (typeof issuedAtSeconds !== "number") return true
  // `iat` has whole-second resolution; compare at that resolution so a token
  // minted in the same second as the revocation (a fresh sign-in right after
  // "sign out everywhere") stays valid.
  return issuedAtSeconds < Math.floor(revokedAt.getTime() / 1000)
}
