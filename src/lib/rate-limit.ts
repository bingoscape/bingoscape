/**
 * Sliding-window rate limiting.
 *
 * DEPLOYMENT ASSUMPTION (decision 9 of epic #183 is unanswered): the app runs
 * as a single instance, so the default store keeps its counters in process
 * memory. They reset on restart and are not shared between instances. If the
 * app is ever scaled out, implement `RateLimitStore` on a shared store (Redis,
 * or a Postgres table) and install it with `setRateLimitStore` from
 * `@/server/rate-limit`; no call site changes.
 */
export interface RateLimitResult {
  allowed: boolean
  /** Seconds until a request would be allowed again (0 when allowed) */
  retryAfterSeconds: number
}

/**
 * Where hit counters live. `hit` records one request for `key` and answers
 * whether it is within `limit` requests per `windowMs`. A blocked request is
 * not recorded, so a client that keeps retrying does not extend its own ban.
 * The result may be a promise so a networked store fits the same interface.
 */
export interface RateLimitStore {
  hit(
    key: string,
    limit: number,
    windowMs: number,
    now?: number
  ): RateLimitResult | Promise<RateLimitResult>
}

/** Per-process store: a sliding window of hit timestamps per key. */
export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, { times: number[]; windowMs: number }>()

  hit(
    key: string,
    limit: number,
    windowMs: number,
    now: number = Date.now()
  ): RateLimitResult {
    const windowStart = now - windowMs
    const recent = (this.hits.get(key)?.times ?? []).filter(
      (t) => t > windowStart
    )

    if (recent.length >= limit) {
      this.hits.set(key, { times: recent, windowMs })
      const retryMs = recent[0]! + windowMs - now
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
      }
    }

    recent.push(now)
    this.hits.set(key, { times: recent, windowMs })

    // Opportunistic cleanup to bound memory: drop keys whose own window has
    // fully passed.
    if (this.hits.size > 10_000) {
      for (const [k, v] of this.hits) {
        if (v.times.every((t) => t <= now - v.windowMs)) this.hits.delete(k)
      }
    }
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

/** A synchronous limiter bound to its own in-memory store. */
export function createRateLimiter(limit: number, windowMs: number) {
  const store = new InMemoryRateLimitStore()
  return function check(key: string, now: number = Date.now()): RateLimitResult {
    return store.hit(key, limit, windowMs, now)
  }
}

/** 30 requests / minute per user for the team-drops feed */
export const teamDropsRateLimiter = createRateLimiter(30, 60_000)

/** 30 requests / minute per user for the team tile-completions feed (separate budget) */
export const teamTileCompletionsRateLimiter = createRateLimiter(30, 60_000)

/** 60 requests / minute per user for the board payload (the plugin polls it) */
export const bingoBoardRateLimiter = createRateLimiter(60, 60_000)
