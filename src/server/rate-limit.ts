import { NextResponse } from "next/server"
import { headers } from "next/headers"

import {
  InMemoryRateLimitStore,
  type RateLimitResult,
  type RateLimitStore,
} from "@/lib/rate-limit"
import {
  RATE_LIMITS,
  type RateLimitPolicyName,
} from "@/lib/rate-limit-policies"
import { logger } from "@/lib/logger"
import type { ActionFailure } from "@/server/authz/guards"

/**
 * Applies the named rate limits (`@/lib/rate-limit-policies`) to server
 * actions, route handlers and the NextAuth callbacks (RBAC 7/8, #190).
 *
 * Single-instance assumption: the default store is in process memory (see
 * `@/lib/rate-limit`). Swap in a shared store with `setRateLimitStore` if the
 * app ever runs on several instances.
 *
 * Not a "use server" module: nothing here is callable from the client.
 */

let store: RateLimitStore = new InMemoryRateLimitStore()

/** Installs another store (a shared one in production, a fresh one in tests). */
export function setRateLimitStore(next: RateLimitStore): void {
  store = next
}

/** Forgets every counter (tests). */
export function resetRateLimits(): void {
  store = new InMemoryRateLimitStore()
}

/**
 * The client address. The app only listens on 127.0.0.1 behind the host nginx
 * (docs/PRODUCTION-SETUP.md: `proxy_set_header X-Forwarded-For
 * $proxy_add_x_forwarded_for`), which appends the address it saw to whatever
 * the client sent. Only the LAST entry is therefore trustworthy; earlier ones
 * are client controlled. `X-Real-IP` is not read for the same reason (nginx
 * does not set it in the documented config). Without the header (direct local
 * access, tests) everybody shares the key "unknown".
 */
export function clientIpFromHeaders(
  get: (name: string) => string | null | undefined
): string {
  const forwarded = get("x-forwarded-for")
  const last = forwarded?.split(",").pop()?.trim()
  return last ? last : "unknown"
}

/** The client address of the current server action / route / component request. */
export async function currentClientIp(): Promise<string> {
  try {
    const h = await headers()
    return clientIpFromHeaders((name) => h.get(name))
  } catch {
    // Outside a request scope (scripts, some tests).
    return "unknown"
  }
}

/** The limiter key: `user:<id>` where authenticated, else `ip:<address>`. */
export async function rateLimitKey(
  userId?: string | null,
  ip?: string
): Promise<string> {
  return userId ? `user:${userId}` : `ip:${ip ?? (await currentClientIp())}`
}

/**
 * Records one request against `policy` for `key`. Fails open (allowed) if the
 * store itself throws: a broken limiter must not take the app down.
 */
export async function checkRateLimit(
  policy: RateLimitPolicyName,
  key: string
): Promise<RateLimitResult> {
  const { limit, windowMs } = RATE_LIMITS[policy]
  try {
    return await store.hit(`${policy}:${key}`, limit, windowMs)
  } catch (error) {
    logger.error({ error, policy }, "Rate limit store failed; allowing request")
    return { allowed: true, retryAfterSeconds: 0 }
  }
}

/** The error NextAuth `authorize` throws for a blocked sign-in; the form shows a message for it. */
export const RATE_LIMITED_ERROR = "RATE_LIMITED"

export const RATE_LIMITED_MESSAGE = "Too many requests. Please try again later."

export interface RateLimitedFailure extends ActionFailure {
  code: "RATE_LIMITED"
  retryAfterSeconds: number
}

/** The server action failure for a blocked request. */
export function rateLimitedFailure(result: RateLimitResult): RateLimitedFailure {
  return {
    success: false,
    error: RATE_LIMITED_MESSAGE,
    code: "RATE_LIMITED",
    retryAfterSeconds: result.retryAfterSeconds,
  }
}

/** The route handler response for a blocked request: 429 + Retry-After. */
export function rateLimitedResponse(result: RateLimitResult): NextResponse {
  return NextResponse.json(
    { error: RATE_LIMITED_MESSAGE, code: "RATE_LIMITED" },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  )
}

/**
 * Convenience for actions: `const limited = await limitAction("signUp"); if
 * (limited) return limited`. Keyed by user id when given, else by IP.
 */
export async function limitAction(
  policy: RateLimitPolicyName,
  userId?: string | null
): Promise<RateLimitedFailure | null> {
  const result = await checkRateLimit(policy, await rateLimitKey(userId))
  return result.allowed ? null : rateLimitedFailure(result)
}

/** Convenience for routes: a 429 response, or null when allowed. */
export async function limitRequest(
  policy: RateLimitPolicyName,
  req: Request,
  userId?: string | null
): Promise<NextResponse | null> {
  const key = userId
    ? `user:${userId}`
    : `ip:${clientIpFromHeaders((name) => req.headers.get(name))}`
  const result = await checkRateLimit(policy, key)
  return result.allowed ? null : rateLimitedResponse(result)
}
