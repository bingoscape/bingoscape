/**
 * @jest-environment node
 *
 * Post-draft analytics (team draft 4/4, #218): reach and steal picks, time per
 * pick (pauses, resumes and undo), auto-pick rate.
 */
import { analyseDraft, pickDurations } from "@/lib/draft/analytics"
import { replayDraft } from "@/lib/draft/reducer"
import type { DraftLogEvent } from "@/lib/draft/types"
import {
  created,
  pickEvent,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"
import { seedDraft } from "@/lib/draft/__tests__/draft-seed"

const START = Date.parse("2026-01-01T00:00:00.000Z")
const at = (seconds: number) => new Date(START + seconds * 1000).toISOString()

describe("reach and steal picks", () => {
  it("best-rated-first picks are all fair", () => {
    const { state, events } = seedDraft({ teams: 4, players: 24 })
    const analytics = analyseDraft(state, events)
    expect(analytics.picks).toHaveLength(24)
    expect(analytics.threshold).toBe(4)
    expect(analytics.picks.every((p) => p.delta === 0)).toBe(true)
    expect(analytics.picks.every((p) => p.verdict === "fair")).toBe(true)
    expect(analytics.reaches).toEqual([])
    expect(analytics.steals).toEqual([])
    // Rank 1 is the best rating.
    expect(analytics.picks[0]).toMatchObject({
      pickNo: 1,
      ratingRank: 1,
      rating: 100,
    })
  })

  it("flags a player taken far too early and a player who lasted far too long", () => {
    const { state, events } = seedDraft({
      teams: 4,
      players: 24,
      // Pick 1 takes the very worst; picks 2 to 8 take the worst left;
      // from pick 9 on, best first again.
      choose: (available, pickNo) => (pickNo <= 8 ? available.length - 1 : 0),
    })
    const analytics = analyseDraft(state, events)

    const first = analytics.picks[0]!
    expect(first).toMatchObject({
      pickNo: 1,
      ratingRank: 24,
      delta: -23,
      verdict: "reach",
    })
    expect(analytics.reaches.map((p) => p.pickNo)).toEqual([1, 2, 3])
    expect(analytics.reaches[0]!.delta).toBe(-23)

    // The best player is finally taken at pick 9: eight picks later than
    // their rank.
    const ninth = analytics.picks[8]!
    expect(ninth).toMatchObject({ pickNo: 9, ratingRank: 1, delta: 8 })
    expect(ninth.verdict).toBe("steal")
    expect(analytics.steals.map((p) => p.pickNo)).toEqual([9, 10, 11])
  })

  it("ranks equal ratings together and gives unrated players no verdict", () => {
    const { state, events } = seedDraft({
      teams: 2,
      players: 8,
      unrated: [0, 1],
    })
    const analytics = analyseDraft(state, events)
    // Best first, so the unrated entries (0 and 1) go first: no rank, no verdict.
    expect(analytics.picks[0]).toMatchObject({
      rating: null,
      ratingRank: null,
      delta: null,
      verdict: null,
    })
    // The best rated player is rank 1 among the 6 rated ones, taken third.
    expect(analytics.picks[2]).toMatchObject({ ratingRank: 1, delta: 2 })
  })
})

describe("time per pick", () => {
  const at0: DraftLogEvent = { ...started, at: at(0) }
  const pick = (
    pickNo: number,
    seconds: number,
    patch: { auto?: boolean; reason?: string | null } = {}
  ): DraftLogEvent => {
    const base = pickEvent(pickNo, { seq: 100 + pickNo * 10 + seconds })
    return {
      ...base,
      at: at(seconds),
      payload: { ...base.payload, ...patch },
    } as DraftLogEvent
  }
  const other = (
    seq: number,
    seconds: number,
    event: Pick<DraftLogEvent, "type" | "payload">
  ) =>
    ({
      seq,
      actorUserId: "manager",
      at: at(seconds),
      ...event,
    }) as DraftLogEvent

  const events: DraftLogEvent[] = [
    created,
    at0,
    pick(1, 30),
    pick(2, 45),
    other(50, 50, { type: "paused", payload: { reason: "manual" } }),
    // The turn starts again when the draft is resumed, not when it began.
    other(51, 200, { type: "resumed", payload: {} }),
    pick(3, 210),
    other(52, 220, {
      type: "undo",
      payload: { pickNo: 3, slotId: "s1", poolEntryId: "e2" },
    }),
    pick(3, 250),
    pick(4, 260, { auto: true, reason: "timer_auto" }),
    other(60, 270, {
      type: "skipped",
      payload: { pickNo: 5, slotId: "s0", reason: "timer_skip" },
    }),
  ]

  it("measures from the event that started the turn: resume and undo restart the clock", () => {
    const seconds = pickDurations(events)
    expect(seconds.get(1)).toBe(30)
    expect(seconds.get(2)).toBe(15)
    // Re-picked after the undo at 220: 30 s, not the 10 s of the undone pick.
    expect(seconds.get(3)).toBe(30)
    // The timer's pick says nothing about the captain.
    expect(seconds.has(4)).toBe(false)
  })

  it("sums up the captains' time and counts the timer's picks", () => {
    const state = replayDraft(events)
    const analytics = analyseDraft(state, events)
    expect(analytics.timing.measured).toBe(3)
    expect(analytics.timing.averageSeconds).toBeCloseTo(25)
    expect(analytics.timing.medianSeconds).toBe(30)
    expect(analytics.timing.slowest).toEqual({ pickNo: 1, seconds: 30 })
    expect(analytics.timing.perTeam).toEqual([
      // Team 1 picked 1 (30 s) and 4 (the timer's).
      { slotId: "s0", teamName: "Team 1", picks: 2, averageSeconds: 30 },
      { slotId: "s1", teamName: "Team 2", picks: 2, averageSeconds: 22.5 },
    ])
    expect(analytics.autoPicks).toEqual({
      count: 1,
      rate: 0.25,
      timerSkips: 1,
      forced: 0,
    })
  })

  it("has no times for a draft without picks", () => {
    const state = replayDraft([created, at0])
    const analytics = analyseDraft(state, [created, at0])
    expect(analytics.timing).toMatchObject({
      measured: 0,
      averageSeconds: null,
      medianSeconds: null,
      slowest: null,
    })
    expect(analytics.autoPicks.rate).toBe(0)
  })
})
