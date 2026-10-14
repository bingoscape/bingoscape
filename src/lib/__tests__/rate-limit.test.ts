/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import { InMemoryRateLimitStore, createRateLimiter } from "@/lib/rate-limit"

describe("createRateLimiter", () => {
  it("allows up to the limit then blocks with Retry-After", () => {
    const check = createRateLimiter(3, 60_000)
    expect(check("u", 0).allowed).toBe(true)
    expect(check("u", 1000).allowed).toBe(true)
    expect(check("u", 2000).allowed).toBe(true)
    const blocked = check("u", 3000)
    expect(blocked.allowed).toBe(false)
    expect(blocked.retryAfterSeconds).toBe(57)
  })

  it("slides the window and isolates keys", () => {
    const check = createRateLimiter(1, 1000)
    expect(check("a", 0).allowed).toBe(true)
    expect(check("b", 0).allowed).toBe(true)
    expect(check("a", 500).allowed).toBe(false)
    expect(check("a", 1001).allowed).toBe(true)
  })
})

describe("InMemoryRateLimitStore", () => {
  it("applies the limit and window passed to each hit", () => {
    const store = new InMemoryRateLimitStore()
    expect(store.hit("k", 2, 1000, 0)).toEqual({ allowed: true, retryAfterSeconds: 0 })
    expect(store.hit("k", 2, 1000, 100).allowed).toBe(true)
    expect(store.hit("k", 2, 1000, 200)).toEqual({ allowed: false, retryAfterSeconds: 1 })
    // The oldest hit leaves the window at t = 1000.
    expect(store.hit("k", 2, 1000, 1001).allowed).toBe(true)
  })

  it("does not count a blocked request, so retrying does not extend the ban", () => {
    const store = new InMemoryRateLimitStore()
    store.hit("k", 1, 1000, 0)
    for (let t = 100; t < 900; t += 100) {
      expect(store.hit("k", 1, 1000, t).allowed).toBe(false)
    }
    expect(store.hit("k", 1, 1000, 1000).allowed).toBe(true)
  })

  it("keeps keys apart", () => {
    const store = new InMemoryRateLimitStore()
    store.hit("a", 1, 1000, 0)
    expect(store.hit("a", 1, 1000, 1).allowed).toBe(false)
    expect(store.hit("b", 1, 1000, 1).allowed).toBe(true)
  })

  it("reports the seconds until the oldest hit expires", () => {
    const store = new InMemoryRateLimitStore()
    store.hit("k", 1, 60_000, 0)
    expect(store.hit("k", 1, 60_000, 1_000).retryAfterSeconds).toBe(59)
  })
})
