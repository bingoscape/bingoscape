/**
 * @jest-environment node
 *
 * Post-draft analytics and the balance data on real Postgres (team draft 4/4,
 * #218), with seeded drafts: 24 players with a skewed distribution, an odd
 * pool of 23, and players without any metadata.
 */
import { and, asc, eq } from "drizzle-orm"

import { computeBalance } from "@/lib/draft/balance"
import { db } from "@/server/db"
import { performPick, type Tx } from "@/server/draft/core"
import { loadDraftAnalytics } from "@/server/draft/analytics"
import { loadDraftSnapshot } from "@/server/draft/queries"
import { draftPoolEntries, playerMetadata } from "@/server/db/schema"
import {
  createDraftWorld,
  startedDraft,
  type DraftWorld,
} from "@/server/__tests__/helpers/draft-fixture"

jest.mock("@/server/auth", () => ({ getServerAuthSession: jest.fn() }))
jest.mock("next/cache", () => ({ revalidatePath: jest.fn() }))
jest.mock("@/lib/logger", () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}))

let w: DraftWorld
afterEach(async () => {
  await w.cleanup()
})

/** The world's participants besides the captains: owner, manager and players. */
const poolUsers = (world: DraftWorld) => [
  world.owner,
  world.manager,
  ...world.players,
]

const ZONES = ["Europe/London", "America/New_York", "Asia/Tokyo", null]

/**
 * Seeds the pool's metadata with a skewed EHP / EHB distribution (a few
 * strong players, a long tail). `skip` users get no metadata at all.
 */
async function seedMetadata(world: DraftWorld, skip: Set<string> = new Set()) {
  const users = poolUsers(world).filter((id) => !skip.has(id))
  await db.insert(playerMetadata).values(
    users.map((userId, i) => ({
      eventId: world.eventId,
      userId,
      ehp: Math.round(2000 * 0.82 ** i),
      ehb: Math.round(900 * 0.8 ** i),
      dailyHoursAvailable: 1 + (i % 5),
      timezone: ZONES[i % ZONES.length],
      skillLevel: "intermediate" as const,
    }))
  )
}

/** Every pick of the draft, best rated first, by the on-turn captain's manager. */
async function draftBestFirst(draftId: string, picks: number) {
  const manager = await w.actorOf(w.manager)
  for (let i = 0; i < picks; i += 1) {
    const entries = await db
      .select()
      .from(draftPoolEntries)
      .where(
        and(
          eq(draftPoolEntries.draftId, draftId),
          eq(draftPoolEntries.status, "available")
        )
      )
      .orderBy(asc(draftPoolEntries.id))
    const best = entries.sort(
      (a, b) => (b.ratingSnapshot ?? -1) - (a.ratingSnapshot ?? -1)
    )[0]!
    const result = await db.transaction((tx) =>
      performPick(tx as Tx, {
        draftId,
        poolEntryId: best.id,
        actor: manager,
        force: true,
      })
    )
    if (!result.success) throw new Error(result.error)
  }
}

describe("analytics of a finished draft", () => {
  it("24 players, skewed: ranks every pick, times them and compares with the optimiser", async () => {
    // A pool of 24 (owner, manager, 22 players) for 4 captains: 6 rounds.
    w = await createDraftWorld({ captains: 4, players: 22 })
    await seedMetadata(w)
    const { draftId } = await startedDraft(w, { rounds: 6 })
    await draftBestFirst(draftId, 24)

    const snapshot = (await loadDraftSnapshot(w.eventId))!
    expect(snapshot.state.status).toBe("complete")
    const { analytics, optimum } = await loadDraftAnalytics(snapshot)

    expect(analytics.picks).toHaveLength(24)
    // Best-rated-first picks: every pick is where its rating says.
    expect(analytics.picks.every((p) => p.delta === 0)).toBe(true)
    expect(analytics.reaches).toEqual([])
    expect(analytics.steals).toEqual([])
    expect(analytics.autoPicks).toMatchObject({ count: 0, rate: 0, forced: 24 })
    // Forced picks are a manager's, not the captain's; they are still timed.
    expect(analytics.timing.measured).toBe(24)
    expect(analytics.timing.averageSeconds).toBeGreaterThanOrEqual(0)

    expect(optimum).not.toBeNull()
    expect(optimum!.teams).toBe(4)
    // 4 captains and 24 drafted players.
    expect(optimum!.players).toBe(28)
    expect(optimum!.gap).toBeGreaterThanOrEqual(0)
    expect(Number.isFinite(optimum!.optimum)).toBe(true)
  })

  it("23 players (odd): the draft ends with players left over and the numbers still hold", async () => {
    // A pool of 23 for 4 captains: 5 rounds of 4 leave three players over.
    w = await createDraftWorld({ captains: 4, players: 21 })
    await seedMetadata(w)
    const { draftId } = await startedDraft(w, { rounds: 5 })
    await draftBestFirst(draftId, 20)

    const snapshot = (await loadDraftSnapshot(w.eventId))!
    expect(snapshot.state.status).toBe("complete")
    expect(
      snapshot.state.pool.filter((e) => e.status === "available")
    ).toHaveLength(3)
    const { analytics, optimum } = await loadDraftAnalytics(snapshot)
    expect(analytics.picks).toHaveLength(20)
    expect(optimum!.players).toBe(24)
    expect(optimum!.gap).not.toBeNull()
  })

  it("players with no metadata are unrated: no rank, no verdict, and the optimiser still scores them", async () => {
    w = await createDraftWorld({ captains: 4, players: 20 })
    // A third of the pool has no metadata row at all.
    const skip = new Set(poolUsers(w).filter((_, i) => i % 3 === 0))
    await seedMetadata(w, skip)
    const { draftId } = await startedDraft(w, { rounds: 5 })
    await draftBestFirst(draftId, 20)

    const snapshot = (await loadDraftSnapshot(w.eventId))!
    const unratedUsers = new Set(
      snapshot.state.pool.filter((e) => e.rating === null).map((e) => e.userId)
    )
    expect(unratedUsers.size).toBe(skip.size)
    const { analytics, optimum } = await loadDraftAnalytics(snapshot)
    const unrated = analytics.picks.filter((p) => p.rating === null)
    expect(unrated.length).toBeGreaterThan(0)
    expect(
      unrated.every(
        (p) => p.ratingRank === null && p.delta === null && p.verdict === null
      )
    ).toBe(true)
    // Rated picks are still ranked among the rated pool only.
    const rated = analytics.picks.filter((p) => p.rating !== null)
    expect(rated.every((p) => p.ratingRank !== null)).toBe(true)
    expect(optimum).not.toBeNull()
  })

  it("a draft nobody has metadata for has no ratings at all and still has analytics", async () => {
    w = await createDraftWorld({ captains: 2, players: 8 })
    const { draftId } = await startedDraft(w, { rounds: 3 })
    await draftBestFirst(draftId, 6)
    const snapshot = (await loadDraftSnapshot(w.eventId))!
    const { analytics, optimum } = await loadDraftAnalytics(snapshot)
    expect(analytics.picks.every((p) => p.rating === null)).toBe(true)
    expect(analytics.reaches).toEqual([])
    expect(optimum).not.toBeNull()
  })
})

describe("what the room shows every member", () => {
  it("carries the players' UTC offsets (not their zones) and ratings, so the balance can be computed", async () => {
    w = await createDraftWorld({ captains: 4, players: 20 })
    await seedMetadata(w)
    const { draftId } = await startedDraft(w, { rounds: 5 })
    await draftBestFirst(draftId, 8)

    const snapshot = (await loadDraftSnapshot(w.eventId))!
    // The offsets of Europe/London, America/New_York and Asia/Tokyo today;
    // the zone names themselves are not sent to the members.
    const offsets = snapshot.players
      .map((p) => p.utcOffset)
      .filter((o): o is number => typeof o === "number")
    expect(new Set(offsets).size).toBe(3)
    expect(offsets.every(Number.isInteger)).toBe(true)
    expect(Math.max(...offsets)).toBe(9)
    expect(JSON.stringify(snapshot.players)).not.toMatch(/Europe|America|Asia/)

    const balance = computeBalance(
      snapshot.state,
      new Map(snapshot.players.map((p) => [p.userId, p]))
    )
    expect(balance.teams).toHaveLength(4)
    // 8 picks over 4 teams: two each, the top players spread by the snake.
    expect(balance.teams.every((t) => t.size === 3)).toBe(true)
    expect(balance.topK).toBe(8)
    expect(balance.teams.reduce((n, t) => n + t.topPlayers, 0)).toBe(8)
    expect(balance.ratingSum.spread).toBeGreaterThanOrEqual(0)
    // The metadata of the draft was not attached to the draft itself: the
    // ratings are the frozen snapshot, not a live recompute.
    expect(
      snapshot.state.pool.filter((e) => e.rating !== null).length
    ).toBeGreaterThan(0)
  })
})
