/**
 * @jest-environment node
 */
import { describe, expect, it, beforeEach } from "@jest/globals"
import { PgDialect } from "drizzle-orm/pg-core"

const mockState: { rows: unknown[]; where: unknown; limit: number | null } = {
  rows: [],
  where: null,
  limit: null,
}

// jest.setup.ts proxies db and prefers globalThis.__TEST_TX__ when set,
// so inject the fake query builder there.
const chain: Record<string, unknown> = {}
for (const m of ["from", "innerJoin", "orderBy"]) chain[m] = () => chain
chain.where = (w: unknown) => {
  mockState.where = w
  return chain
}
chain.limit = (n: number) => {
  mockState.limit = n
  return Promise.resolve(mockState.rows)
}
;(globalThis as { __TEST_TX__?: unknown }).__TEST_TX__ = { select: () => chain }

import { fetchTeamTileCompletions } from "@/lib/team-tile-completions"
import { createRateLimiter, teamTileCompletionsRateLimiter, teamDropsRateLimiter } from "@/lib/rate-limit"
import { decodeCursor, encodeCursor } from "@/lib/team-drops"

const id = "0b9f3c1e-8a52-4c1d-9a55-1f2e3d4c5b6a"
const after = { t: "2026-01-02T03:04:05.123456Z", id }

const row = (n: number) => ({
  id: `0b9f3c1e-8a52-4c1d-9a55-1f2e3d4c5b6${n}`,
  completedAt: `2026-01-02T03:04:0${n}.000001Z`,
  eventId: "e",
  bingoId: "b",
  teamId: "t",
  teamName: "Team",
  tileId: "ti",
  tileTitle: "Tile",
  points: 10,
  tier: 2,
})

beforeEach(() => {
  mockState.rows = []
  mockState.where = null
  mockState.limit = null
})

describe("fetchTeamTileCompletions", () => {
  it("short-circuits with no teams", async () => {
    const r = await fetchTeamTileCompletions({ teamIds: [], after, limit: 5 })
    expect(r).toEqual({ completions: [], hasMore: false })
    expect(mockState.limit).toBeNull()
  })

  it("maps rows, nests tile points/tier and detects hasMore via limit+1", async () => {
    mockState.rows = [row(1), row(2), row(3)]
    const r = await fetchTeamTileCompletions({ teamIds: ["t"], after, limit: 2 })
    expect(mockState.limit).toBe(3)
    expect(r.hasMore).toBe(true)
    expect(r.completions).toHaveLength(2)
    expect(r.completions[0]!.tile).toEqual({ points: 10, tier: 2 })
    // cursor built from the last item round-trips
    const last = r.completions[1]!
    expect(decodeCursor(encodeCursor({ t: last.completedAt, id: last.id }))).toEqual({
      t: last.completedAt,
      id: last.id,
    })
  })

  it("filters: completed only, visible bingos, lag, keyset; does not exclude the caller", async () => {
    await fetchTeamTileCompletions({ teamIds: ["t"], after, limit: 5 })
    const q = new PgDialect().sqlToQuery(mockState.where as never)
    expect(q.sql).toContain('"status" = $')
    expect(q.params).toContain("completed")
    expect(q.params).toContain(true) // bingos.visible
    expect(q.sql).toContain("interval '2 seconds'")
    expect(q.sql).toContain('"completed_at"')
    expect(q.params).toEqual(expect.arrayContaining([after.t, after.id]))
    expect(q.sql).not.toContain("submitted_by")
    expect(q.sql).not.toContain("<>")
  })
})

describe("rate limiters", () => {
  it("tile-completions limiter is its own instance", () => {
    expect(teamTileCompletionsRateLimiter).not.toBe(teamDropsRateLimiter)
    for (let i = 0; i < 30; i++) expect(teamTileCompletionsRateLimiter("u1", 0).allowed).toBe(true)
    expect(teamTileCompletionsRateLimiter("u1", 1).allowed).toBe(false)
    expect(teamDropsRateLimiter("u1", 1).allowed).toBe(true)
    expect(createRateLimiter(1, 1)("x").allowed).toBe(true)
  })
})
