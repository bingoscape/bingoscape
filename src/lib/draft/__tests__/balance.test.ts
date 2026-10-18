/**
 * @jest-environment node
 *
 * The live balance metrics (team draft 4/4, #218): sums, means, spread, top-k
 * players and time zone coverage per team, over the picks so far.
 */
import { computeBalance, offsetLabel, spreadOf } from "@/lib/draft/balance"
import { replayDraft } from "@/lib/draft/reducer"
import type { DraftPlayerInfo } from "@/lib/draft/types"
import {
  created,
  info,
  pickEvent,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"
import { seedDraft } from "@/lib/draft/__tests__/draft-seed"

describe("spreadOf", () => {
  it("is the population standard deviation and the range", () => {
    expect(spreadOf([2, 4, 4, 4, 5, 5, 7, 9])).toEqual({
      stdev: 2,
      spread: 7,
    })
  })

  it("is zero for fewer than two values", () => {
    expect(spreadOf([])).toEqual({ stdev: 0, spread: 0 })
    expect(spreadOf([42])).toEqual({ stdev: 0, spread: 0 })
  })
})

describe("offsetLabel", () => {
  it("reads east of UTC as plus", () => {
    expect(offsetLabel(0)).toBe("UTC")
    expect(offsetLabel(9)).toBe("UTC+9")
    expect(offsetLabel(-5)).toBe("UTC-5")
  })
})

describe("computeBalance on a hand-checked draft", () => {
  // Pool e0 .9, e1 .7, e2 .5, e3 unrated; snake: s0 takes e0 and e3, s1 takes
  // e1 and e2. The captains are c0 / c1.
  const state = replayDraft([
    created,
    started,
    pickEvent(1),
    pickEvent(2),
    pickEvent(3),
    pickEvent(4),
  ])
  const withZones = (offsets: Record<string, number | null>) =>
    new Map<string, DraftPlayerInfo>(
      Object.entries(offsets).map(([id, utcOffset]) => [
        id,
        { ...info(id, id), utcOffset },
      ])
    )

  it("sums and averages the rated players of each team", () => {
    const balance = computeBalance(state, withZones({}))
    const [one, two] = balance.teams
    expect(one).toMatchObject({
      teamName: "Team 1",
      size: 3,
      rated: 1,
      unrated: 1,
    })
    expect(one!.ratingSum).toBeCloseTo(90)
    expect(one!.ratingMean).toBeCloseTo(90)
    expect(two).toMatchObject({ size: 3, rated: 2, unrated: 0 })
    expect(two!.ratingSum).toBeCloseTo(120)
    expect(two!.ratingMean).toBeCloseTo(60)
    expect(balance.ratingSum.spread).toBeCloseTo(30)
    expect(balance.ratingSum.stdev).toBeCloseTo(15)
    expect(balance.ratingMean.spread).toBeCloseTo(30)
    expect(balance.ratingMean.stdev).toBeCloseTo(15)
  })

  it("counts each team's players among the pool's best (two per team, at most the rated pool)", () => {
    const balance = computeBalance(state, withZones({}))
    // Two teams ask for the top 4, only 3 players are rated.
    expect(balance.topK).toBe(3)
    expect(balance.teams.map((t) => t.topPlayers)).toEqual([1, 2])
  })

  it("lists the time zones of the captain and the drafted players, and the unknown ones", () => {
    const balance = computeBalance(
      state,
      withZones({
        c0: 9,
        p0: 0,
        p3: null,
        c1: -5,
        p1: -5,
        p2: 1,
      })
    )
    expect(balance.teams[0]!.timezones).toEqual({
      offsets: [0, 9],
      labels: ["UTC", "UTC+9"],
      unknown: 1,
    })
    expect(balance.teams[1]!.timezones).toEqual({
      offsets: [-5, 1],
      labels: ["UTC-5", "UTC+1"],
      unknown: 0,
    })
  })

  it("is empty-safe before the first pick", () => {
    const balance = computeBalance(
      replayDraft([created, started]),
      withZones({})
    )
    expect(balance.teams.map((t) => t.ratingMean)).toEqual([null, null])
    expect(balance.ratingSum).toEqual({ stdev: 0, spread: 0 })
    expect(balance.ratingMean).toEqual({ stdev: 0, spread: 0 })
  })
})

describe("computeBalance on seeded drafts", () => {
  /** The same numbers worked out directly from the picks. */
  function expected(seed: ReturnType<typeof seedDraft>) {
    const sums = seed.state.slots.map((slot) =>
      seed.state.picks
        .filter((p) => p.slotId === slot.slotId)
        .reduce((sum, p) => {
          const rating = seed.ratings[Number(p.poolEntryId.slice(1))]
          return sum + (rating == null ? 0 : rating * 100)
        }, 0)
    )
    return spreadOf(sums)
  }

  it("24 players with a skewed distribution: best-first picks give an even snake", () => {
    const seed = seedDraft({
      teams: 4,
      players: 24,
      utcOffsets: [0, -5, 9, null],
    })
    expect(seed.state.picks).toHaveLength(24)
    const balance = computeBalance(seed.state, seed.players)
    const want = expected(seed)
    expect(balance.ratingSum.stdev).toBeCloseTo(want.stdev)
    expect(balance.ratingSum.spread).toBeCloseTo(want.spread)
    // Every team has 6 drafted players plus the captain, and the 8 best
    // rated players are spread two to a team by a snake.
    expect(balance.teams.every((t) => t.size === 7 && t.rated === 6)).toBe(true)
    expect(balance.topK).toBe(8)
    expect(balance.teams.map((t) => t.topPlayers)).toEqual([2, 2, 2, 2])
    // A skewed pool with a snake keeps the sums close: well under the
    // best player alone (100 points).
    expect(balance.ratingSum.spread).toBeLessThan(25)
  })

  it("shows an unbalanced draft: one team takes all the strong players", () => {
    // Team 1 takes the best entry on its turns, team 2 the worst.
    const seed = seedDraft({
      teams: 2,
      players: 8,
      choose: (available, pickNo) => {
        const first = pickNo % 4 === 1 || pickNo % 4 === 0
        return first ? 0 : available.length - 1
      },
    })
    const balance = computeBalance(seed.state, seed.players)
    expect(balance.teams[0]!.ratingSum).toBeGreaterThan(
      balance.teams[1]!.ratingSum
    )
    expect(balance.ratingSum.spread).toBeGreaterThan(40)
    expect(balance.teams[0]!.topPlayers).toBeGreaterThan(
      balance.teams[1]!.topPlayers
    )
  })

  it("23 players (odd): the last round is never played and the numbers still hold", () => {
    const seed = seedDraft({ teams: 4, players: 23 })
    // 5 rounds of 4 picks: 20 players are drafted, 3 are left in the pool.
    expect(seed.state.picks).toHaveLength(20)
    const balance = computeBalance(seed.state, seed.players)
    expect(balance.teams.every((t) => t.size === 6)).toBe(true)
    const want = expected(seed)
    expect(balance.ratingSum.stdev).toBeCloseTo(want.stdev)
    expect(balance.topK).toBe(8)
  })

  it("players without metadata are unrated: counted, but out of sums, means and top players", () => {
    const seed = seedDraft({
      teams: 4,
      players: 24,
      unrated: [0, 5, 6, 7, 20, 21, 22, 23],
    })
    const balance = computeBalance(seed.state, seed.players)
    expect(balance.teams.reduce((n, t) => n + t.unrated, 0)).toBe(8)
    expect(balance.teams.reduce((n, t) => n + t.rated, 0)).toBe(16)
    // 16 players are rated, so top-k stays at 8 (2 per team) but never
    // counts an unrated player.
    expect(balance.topK).toBe(8)
    const topIds = new Set(
      seed.state.pool
        .filter((e) => e.rating !== null)
        .sort((a, b) => b.rating! - a.rating!)
        .slice(0, 8)
        .map((e) => e.poolEntryId)
    )
    const topPicked = seed.state.picks.filter((p) =>
      topIds.has(p.poolEntryId)
    ).length
    expect(balance.teams.reduce((n, t) => n + t.topPlayers, 0)).toBe(topPicked)
    expect(balance.teams.every((t) => Number.isFinite(t.ratingSum))).toBe(true)
  })

  it("a pool nobody could rate has no top players and no means", () => {
    const seed = seedDraft({
      teams: 2,
      players: 6,
      unrated: [0, 1, 2, 3, 4, 5],
    })
    const balance = computeBalance(seed.state, seed.players)
    expect(balance.topK).toBe(0)
    expect(balance.teams.map((t) => t.topPlayers)).toEqual([0, 0])
    expect(balance.teams.map((t) => t.ratingMean)).toEqual([null, null])
    expect(balance.ratingMean).toEqual({ stdev: 0, spread: 0 })
  })
})
