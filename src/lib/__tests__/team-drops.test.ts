/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from "@jest/globals"

jest.mock("@/server/db", () => ({ db: {} }))

import {
  clampLimit,
  decodeCursor,
  encodeCursor,
} from "@/lib/team-drops"

const id = "0b9f3c1e-8a52-4c1d-9a55-1f2e3d4c5b6a"

describe("cursor", () => {
  it("round-trips with microsecond precision", () => {
    const c = { t: "2026-01-02T03:04:05.123456Z", id }
    const raw = encodeCursor(c)
    expect(raw).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(decodeCursor(raw)).toEqual(c)
  })

  it("rejects malformed cursors", () => {
    expect(decodeCursor("not-a-cursor")).toBeNull()
    expect(decodeCursor("")).toBeNull()
    const b64 = (o: unknown) =>
      Buffer.from(JSON.stringify(o)).toString("base64url")
    expect(decodeCursor(b64({ t: "x", id }))).toBeNull()
    expect(decodeCursor(b64({ t: "2026-01-02T03:04:05.123456Z", id: "x" }))).toBeNull()
    expect(decodeCursor(b64([1, 2]))).toBeNull()
  })
})

describe("clampLimit", () => {
  it("defaults and clamps", () => {
    expect(clampLimit(null)).toBe(50)
    expect(clampLimit("abc")).toBe(50)
    expect(clampLimit("0")).toBe(1)
    expect(clampLimit("-5")).toBe(1)
    expect(clampLimit("1000")).toBe(100)
    expect(clampLimit("25")).toBe(25)
  })
})
