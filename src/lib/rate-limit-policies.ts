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
  /** Asking to join an Event that needs approval, per user. */
  joinRequest: { limit: 20, windowMs: HOUR },
  /** Creating Events, per user. */
  eventCreate: { limit: 10, windowMs: HOUR },
  /** Image uploads (manual and RuneLite submissions), per user. */
  upload: { limit: 30, windowMs: MINUTE },
  /** Wise Old Man proxy actions, per user (they spend the server's WOM quota). */
  wiseOldMan: { limit: 20, windowMs: MINUTE },
  /** `POST /api/runelite/auth` (unauthenticated key check), per client IP. */
  runeliteAuth: { limit: 30, windowMs: MINUTE },
} as const satisfies Record<string, RateLimitPolicy>

export type RateLimitPolicyName = keyof typeof RATE_LIMITS
