/**
 * @jest-environment node
 */
import { replayDraft } from "@/lib/draft/reducer"
import type { DraftLogEvent, DraftPlayerInfo } from "@/lib/draft/types"
import {
  currentRound,
  filterPool,
  onTurnSlot,
  playerLabel,
  ratingPoints,
  rosterOf,
} from "@/lib/draft/view"

const AT = "2026-01-01T00:00:00.000Z"

const log: DraftLogEvent[] = [
  {
    seq: 1,
    type: "created",
    actorUserId: "m",
    at: AT,
    payload: {
      orderType: "snake",
      rounds: 2,
      pickTimerSeconds: null,
      onTimeout: "auto_pick",
      autoPickRule: "best_rated",
      slots: [0, 1, 2].map((i) => ({
        slotId: `s${i}`,
        position: i,
        captainUserId: `c${i}`,
        teamName: `Team ${i}`,
        maxTeamSize: 3,
      })),
    },
  },
  {
    seq: 2,
    type: "started",
    actorUserId: "m",
    at: AT,
    payload: {
      seed: 1,
      permutation: [0, 1, 2],
      slots: [0, 1, 2].map((i) => ({ slotId: `s${i}`, teamId: `t${i}` })),
      pool: [
        { poolEntryId: "e0", userId: "u0", rating: 0.2, ratingSource: "x" },
        { poolEntryId: "e1", userId: "u1", rating: 0.9, ratingSource: "x" },
        { poolEntryId: "e2", userId: "u2", rating: null, ratingSource: "x" },
        { poolEntryId: "e3", userId: "u3", rating: 0.9, ratingSource: "x" },
        { poolEntryId: "e4", userId: null, rating: 0.5, ratingSource: "x" },
      ],
    },
  },
]

const pickEvent = (
  seq: number,
  pickNo: number,
  slotId: string,
  entry: string
) =>
  ({
    seq,
    type: "pick",
    actorUserId: "c",
    at: AT,
    payload: {
      pickNo,
      round: Math.ceil(pickNo / 3),
      slotId,
      poolEntryId: entry,
      userId: `u${entry.slice(1)}`,
      auto: false,
      forced: false,
      reason: null,
    },
  }) as DraftLogEvent

const info = (
  userId: string,
  name: string | null,
  skillLevel: string | null = null,
  runescapeName: string | null = null
): [string, DraftPlayerInfo] => [
  userId,
  { userId, name, runescapeName, image: null, skillLevel },
]

const players = new Map([
  info("u0", "Zed", "beginner"),
  info("u1", "Amy", "expert", "AmyRS"),
  info("u2", "Bob", null),
  info("u3", "Cat", "expert"),
])

describe("onTurnSlot / currentRound", () => {
  it("follows the snake and names no slot outside a running draft", () => {
    let state = replayDraft(log)
    expect(onTurnSlot(state)!.slotId).toBe("s0")
    state = replayDraft([...log, pickEvent(3, 1, "s0", "e0")])
    expect(onTurnSlot(state)!.slotId).toBe("s1")
    state = replayDraft([
      ...log,
      pickEvent(3, 1, "s0", "e0"),
      pickEvent(4, 2, "s1", "e1"),
      pickEvent(5, 3, "s2", "e2"),
    ])
    // Round 2 reverses: the last slot picks again.
    expect(onTurnSlot(state)!.slotId).toBe("s2")
    expect(currentRound(state)).toBe(2)

    expect(onTurnSlot(replayDraft(log.slice(0, 1)))).toBeNull()
    expect(
      onTurnSlot(
        replayDraft([
          ...log,
          { seq: 9, type: "paused", actorUserId: "m", at: AT, payload: {} },
        ])
      )!.slotId
    ).toBe("s0")
    expect(
      onTurnSlot(
        replayDraft([
          ...log,
          { seq: 9, type: "completed", actorUserId: null, at: AT, payload: {} },
        ])
      )
    ).toBeNull()
  })
})

describe("rosterOf", () => {
  it("lists the captain, then the picks in order", () => {
    const state = replayDraft([
      ...log,
      pickEvent(3, 1, "s0", "e0"),
      pickEvent(4, 2, "s1", "e1"),
      pickEvent(5, 4, "s0", "e3"),
    ])
    const roster = rosterOf(state, state.slots[0]!)
    expect(roster.map((r) => [r.userId, r.pickNo, r.captain])).toEqual([
      ["c0", null, true],
      ["u0", 1, false],
      ["u3", 4, false],
    ])
    expect(roster[1]!.rating).toBe(0.2)
  })
})

describe("filterPool", () => {
  const state = replayDraft([...log, pickEvent(3, 1, "s0", "e1")])
  const ids = (list: { poolEntryId: string }[]) =>
    list.map((e) => e.poolEntryId)

  it("hides drafted players and sorts by rating with unrated last", () => {
    expect(
      ids(filterPool(state.pool, players, { q: "", skill: "", sort: "rating" }))
    ).toEqual(["e3", "e4", "e0", "e2"])
  })

  it("sorts by name; a deleted account sorts as Unknown player", () => {
    expect(
      ids(filterPool(state.pool, players, { q: "", skill: "", sort: "name" }))
    ).toEqual(["e2", "e3", "e4", "e0"])
  })

  it("searches by RuneScape or account name and filters by skill", () => {
    const all = replayDraft(log).pool
    expect(
      ids(filterPool(all, players, { q: "amyrs", skill: "", sort: "name" }))
    ).toEqual(["e1"])
    expect(
      ids(filterPool(all, players, { q: "amy", skill: "", sort: "name" }))
    ).toEqual(["e1"])
    expect(
      ids(filterPool(all, players, { q: "", skill: "expert", sort: "rating" }))
    ).toEqual(["e1", "e3"])
    expect(
      ids(filterPool(all, players, { q: "zzz", skill: "", sort: "name" }))
    ).toEqual([])
  })
})

describe("labels", () => {
  it("prefers the RuneScape name and copes with a deleted account", () => {
    expect(playerLabel(players.get("u1"))).toBe("AmyRS")
    expect(playerLabel(players.get("u2"))).toBe("Bob")
    expect(playerLabel(undefined)).toBe("Unknown player")
    expect(ratingPoints(0.876)).toBe(88)
    expect(ratingPoints(null)).toBeNull()
  })
})
