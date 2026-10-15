/**
 * The fixed rate limits of the app (RBAC 7/8, #190). Counters are per key
 * (user id where the caller is authenticated, else the client IP) and per
 * policy; see `@/server/rate-limit` for how they are applied and
 * `@/lib/rate-limit` for the single-instance assumption.
 *
 * Numbers are deliberately generous for a human and tight for a script.
 */
export interface RateLimitPolicy {
  /** Requests allowed per window. */
  limit: number
  windowMs: number
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const RATE_LIMITS = {
  /** Credentials sign-in attempts per client IP. */
  signInIp: { limit: 20, windowMs: 15 * MINUTE },
  /**
   * Credentials sign-in attempts per username from one IP. Keyed by both so an
   * attacker cannot lock a victim out by hammering their username from
   * elsewhere; guessing spread over many IPs is not covered.
   */
  signInAccount: { limit: 10, windowMs: 15 * MINUTE },
  /** Sign-ups per client IP. */
  signUp: { limit: 5, windowMs: HOUR },
  /** Creating invite links, per user. */
  inviteCreate: { limit: 30, windowMs: HOUR },
  /** Redeeming / looking up invite codes, per user or IP (stops code guessing). */
  inviteRedeem: { limit: 30, windowMs: 15 * MINUTE },
  /** Creating Events, per user. */
  eventCreate: { limit: 10, windowMs: HOUR },
  /** Image uploads (manual and RuneLite submissions), per user. */
  upload: { limit: 30, windowMs: MINUTE },
  /** Wise Old Man proxy actions, per user (they spend the server's WOM quota). */
  wiseOldMan: { limit: 20, windowMs: MINUTE },
  /** `POST /api/runelite/auth` (unauthenticated key check), per client IP. */
  runeliteAuth: { limit: 30, windowMs: MINUTE },
  /**
   * Draft picks (`makePick`, `forcePick`), per user. A captain picks once per
   * turn; this only stops a script from hammering the row lock.
   */
  draftPick: { limit: 60, windowMs: MINUTE },
  /**
   * Opening a draft stream (GET .../draft/stream), per user. A stream lives
   * about 5 minutes, so this only stops a reconnect loop.
   */
  draftStream: { limit: 30, windowMs: MINUTE },
  /**
   * Rendering the "Share as image" recap (GET .../draft/recap-image), per
   * user. The picture is drawn on the server, which costs some CPU.
   */
  draftRecapImage: { limit: 20, windowMs: MINUTE },
  /**
   * `GET /api/osrs-image/...` requests that miss the cache and would fetch
   * from the OSRS Wiki, per client IP. Cache hits are not counted. Generous
   * enough for a board of new images loaded at once, tight for a script that
   * walks the key space.
   */
  osrsImageMiss: { limit: 120, windowMs: MINUTE },
  /**
   * Admin refresh of one cached wiki image (`refreshImage`), per admin. Each
   * one is a request to the wiki; a human clicking through a list stays far
   * below this.
   */
  osrsImageRefresh: { limit: 20, windowMs: MINUTE },
  /**
   * Starting or resuming the bulk refresh (`refreshAllImages`), per admin. A
   * run is paced at about 1 request/s by itself; this only stops a start/stop
   * loop from re-marking every image over and over.
   */
  osrsImageRefreshAll: { limit: 3, windowMs: HOUR },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitPolicyName = keyof typeof RATE_LIMITS
