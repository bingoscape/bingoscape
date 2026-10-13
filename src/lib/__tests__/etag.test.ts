/**
 * @jest-environment node
 */
import { describe, expect, it } from "@jest/globals"
import { computeEtag, ifNoneMatchHits } from "@/lib/etag"

describe("computeEtag", () => {
  it("is a quoted, deterministic hash of the value", () => {
    const etag = computeEtag({ a: 1, b: [2] })
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/)
    expect(computeEtag({ a: 1, b: [2] })).toBe(etag)
    expect(computeEtag({ a: 2, b: [2] })).not.toBe(etag)
  })
})

describe("ifNoneMatchHits", () => {
  const etag = '"abc"'

  it("matches exact, weak, listed and wildcard validators", () => {
    expect(ifNoneMatchHits('"abc"', etag)).toBe(true)
    expect(ifNoneMatchHits('W/"abc"', etag)).toBe(true)
    expect(ifNoneMatchHits('"x", "abc"', etag)).toBe(true)
    expect(ifNoneMatchHits("*", etag)).toBe(true)
  })

  it("does not match a missing or different validator", () => {
    expect(ifNoneMatchHits(null, etag)).toBe(false)
    expect(ifNoneMatchHits("", etag)).toBe(false)
    expect(ifNoneMatchHits('"abd"', etag)).toBe(false)
  })
})
