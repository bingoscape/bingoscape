/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import { createRateLimiter } from "@/lib/rate-limit"

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
