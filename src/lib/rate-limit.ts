/**
 * In-memory sliding-window rate limiter.
 * State is per server process; suitable for a single-instance deployment.
 */
export interface RateLimitResult {
  allowed: boolean
  /** Seconds until a request would be allowed again (0 when allowed) */
  retryAfterSeconds: number
}

export function createRateLimiter(limit: number, windowMs: number) {
  const hits = new Map<string, number[]>()

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    const windowStart = now - windowMs
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart)

    if (recent.length >= limit) {
      hits.set(key, recent)
      const retryMs = recent[0]! + windowMs - now
      return {
        allowed: false,
        retryAfterSeconds: Math.max(1, Math.ceil(retryMs / 1000)),
      }
    }

    recent.push(now)
    hits.set(key, recent)

    // Opportunistic cleanup to bound memory
    if (hits.size > 10_000) {
      for (const [k, v] of hits) {
        if (v.every((t) => t <= windowStart)) hits.delete(k)
      }
    }
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

/** 30 requests / minute per user for the team-drops feed */
export const teamDropsRateLimiter = createRateLimiter(30, 60_000)
