/**
 * @jest-environment node
 */
import { RATE_LIMITS } from "@/lib/rate-limit-policies"
import type { RateLimitStore } from "@/lib/rate-limit"
import {
  checkRateLimit,
  clientIpFromHeaders,
  limitAction,
  limitRequest,
  rateLimitKey,
  rateLimitedFailure,
  resetRateLimits,
  setRateLimitStore,
} from "@/server/rate-limit"

let headerValues: Record<string, string> = {}
jest.mock("next/headers", () => ({
  headers: async () => ({
    get: (name: string) => headerValues[name.toLowerCase()] ?? null,
  }),
}))

beforeEach(() => {
  headerValues = {}
  resetRateLimits()
})

describe("clientIpFromHeaders", () => {
  const from = (value: string | null) =>
    clientIpFromHeaders((name) => (name === "x-forwarded-for" ? value : null))

  it("trusts only the last entry, the one the host nginx appended", () => {
    expect(from("203.0.113.9")).toBe("203.0.113.9")
    expect(from("6.6.6.6, 203.0.113.9")).toBe("203.0.113.9")
    expect(from("6.6.6.6,7.7.7.7 , 203.0.113.9 ")).toBe("203.0.113.9")
  })

  it("falls back to a shared key without the header", () => {
    expect(from(null)).toBe("unknown")
    expect(from("")).toBe("unknown")
  })
})

describe("rate limiting", () => {
  it("blocks after the policy's limit, per key", async () => {
    const { limit } = RATE_LIMITS.eventCreate
    for (let i = 0; i < limit; i++) {
      expect((await checkRateLimit("eventCreate", "user:a")).allowed).toBe(true)
    }
    const blocked = await checkRateLimit("eventCreate", "user:a")
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
    // Another user and another policy have their own budget.
    expect((await checkRateLimit("eventCreate", "user:b")).allowed).toBe(true)
    expect((await checkRateLimit("upload", "user:a")).allowed).toBe(true)
  })

  it("keys by user id when authenticated, else by IP", async () => {
    headerValues["x-forwarded-for"] = "198.51.100.4"
    expect(await rateLimitKey("u1")).toBe("user:u1")
    expect(await rateLimitKey(null)).toBe("ip:198.51.100.4")
  })

  it("answers an action with RATE_LIMITED and the wait time", async () => {
    headerValues["x-forwarded-for"] = "198.51.100.4"
    const { limit } = RATE_LIMITS.signUp
    for (let i = 0; i < limit; i++) expect(await limitAction("signUp")).toBeNull()

    const failure = await limitAction("signUp")
    expect(failure).toMatchObject({
      success: false,
      code: "RATE_LIMITED",
      error: expect.any(String),
    })
    expect(failure!.retryAfterSeconds).toBeGreaterThan(0)

    // A different client IP is unaffected.
    headerValues["x-forwarded-for"] = "198.51.100.5"
    expect(await limitAction("signUp")).toBeNull()
  })

  it("answers a route with 429 and Retry-After", async () => {
    const req = new Request("http://localhost/api/runelite/auth", {
      headers: { "x-forwarded-for": "198.51.100.4" },
    })
    const { limit } = RATE_LIMITS.runeliteAuth
    for (let i = 0; i < limit; i++) {
      expect(await limitRequest("runeliteAuth", req)).toBeNull()
    }

    const response = await limitRequest("runeliteAuth", req)
    expect(response!.status).toBe(429)
    expect(Number(response!.headers.get("Retry-After"))).toBeGreaterThan(0)
    await expect(response!.json()).resolves.toMatchObject({ code: "RATE_LIMITED" })
  })

  it("uses the user id for a route when given", async () => {
    const req = new Request("http://localhost/x", {
      headers: { "x-forwarded-for": "198.51.100.4" },
    })
    const { limit } = RATE_LIMITS.upload
    for (let i = 0; i < limit; i++) await limitRequest("upload", req, "u1")
    expect(await limitRequest("upload", req, "u1")).not.toBeNull()
    // Same IP, other user: own budget.
    expect(await limitRequest("upload", req, "u2")).toBeNull()
  })

  it("accepts another store, so a shared one can be swapped in", async () => {
    const calls: string[] = []
    const store: RateLimitStore = {
      hit: async (key, limit, windowMs) => {
        calls.push(`${key}:${limit}:${windowMs}`)
        return { allowed: false, retryAfterSeconds: 7 }
      },
    }
    setRateLimitStore(store)

    const result = await checkRateLimit("upload", "user:x")

    expect(result).toEqual({ allowed: false, retryAfterSeconds: 7 })
    expect(calls).toEqual([
      `upload:user:x:${RATE_LIMITS.upload.limit}:${RATE_LIMITS.upload.windowMs}`,
    ])
    expect(rateLimitedFailure(result).retryAfterSeconds).toBe(7)
  })

  it("fails open when the store breaks", async () => {
    setRateLimitStore({
      hit: () => {
        throw new Error("redis down")
      },
    })
    jest.spyOn(console, "error").mockImplementation(() => undefined)
    expect((await checkRateLimit("upload", "user:x")).allowed).toBe(true)
  })
})
