/** Session lifetime (Better Auth `session.expiresIn` / `updateAge`). */

/** A session is valid for this long after sign-in (sliding, see the update age). */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

/** The session's expiry is extended at most this often. */
export const SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60
