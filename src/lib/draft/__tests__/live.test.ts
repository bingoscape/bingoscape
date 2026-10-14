/**
 * @jest-environment node
 */
import {
  initialLiveState,
  isGap,
  liveReducer,
  unknownUserIds,
} from "@/lib/draft/live"
import { replayDraft } from "@/lib/draft/reducer"
import type { DraftLogEvent } from "@/lib/draft/types"

import {
  created,
  info,
  pickEvent,
  PLAYERS,
  snapshotOf,
  started,
} from "./draft-fixtures"

const fresh = () => initialLiveState(snapshotOf([created, started]))

const undo = (pickNo: number, seq = 9): DraftLogEvent => {
  const pick = pickEvent(pickNo)
  return {
    seq,
    type: "undo",
    actorUserId: "manager",
    at: "2026-01-01T00:00:00.000Z",
    payload: {
      pickNo,
      slotId: pick.type === "pick" ? pick.payload.slotId : "",
      poolEntryId: `e${pickNo - 1}`,
    },
  }
}

describe("liveReducer events", () => {
  it("applies events in order and tracks lastSeq", () => {
    const next = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1)],
    })
    expect(next.state.lastSeq).toBe(3)
    expect(next.state.currentPickNo).toBe(2)
    expect(next.needsResync).toBe(false)
  })

  it("ignores duplicates and events at or below lastSeq without a new object", () => {
    const once = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1)],
    })
    const again = liveReducer(once, { type: "events", events: [pickEvent(1)] })
    expect(again).toBe(once)
    const old = liveReducer(once, {
      type: "events",
      events: [started, created],
    })
    expect(old).toBe(once)
  })

  it("applies events delivered out of order by seq", () => {
    const next = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(2), pickEvent(1)],
    })
    expect(next.state.picks.map((p) => p.pickNo)).toEqual([1, 2])
    expect(next.state.lastSeq).toBe(4)
    expect(next.needsResync).toBe(false)
  })

  it("matches replaying the whole log", () => {
    const events = [created, started, pickEvent(1), pickEvent(2), pickEvent(3)]
    let live = initialLiveState(snapshotOf([created, started]))
    for (const event of events.slice(2)) {
      live = liveReducer(live, { type: "events", events: [event] })
    }
    expect(live.state).toEqual(replayDraft(events))
  })

  it("flags a gap, a pick that does not follow, and stops there", () => {
    const next = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(2), pickEvent(3)],
    })
    expect(next.needsResync).toBe(true)
    // Nothing after the gap was applied.
    expect(next.state.currentPickNo).toBe(1)
    expect(next.state.lastSeq).toBe(2)
  })

  it("keeps what was applied before a gap", () => {
    const next = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1), pickEvent(3)],
    })
    expect(next.needsResync).toBe(true)
    expect(next.state.currentPickNo).toBe(2)
  })

  it("treats an undo of another pick as a gap", () => {
    const afterTwo = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1), pickEvent(2)],
    })
    const next = liveReducer(afterTwo, { type: "events", events: [undo(1)] })
    expect(next.needsResync).toBe(true)
  })

  it("applies an undo of the last pick", () => {
    const afterOne = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1)],
    })
    const next = liveReducer(afterOne, { type: "events", events: [undo(1)] })
    expect(next.needsResync).toBe(false)
    expect(next.state.currentPickNo).toBe(1)
    expect(next.state.picks).toHaveLength(0)
  })

  it("asks for a resync when an event brings in a user without a name", () => {
    const withoutPool = initialLiveState(
      snapshotOf([created], [info("c0", "Captain One"), info("c1", "Two")])
    )
    const next = liveReducer(withoutPool, { type: "events", events: [started] })
    expect(next.state.status).toBe("in_progress")
    expect(next.needsResync).toBe(true)
  })
})

describe("liveReducer snapshot", () => {
  it("replaces the state and clears needsResync", () => {
    const gap = liveReducer(fresh(), { type: "events", events: [pickEvent(3)] })
    expect(gap.needsResync).toBe(true)
    const next = liveReducer(gap, {
      type: "snapshot",
      snapshot: snapshotOf([created, started, pickEvent(1), pickEvent(2)]),
    })
    expect(next.needsResync).toBe(false)
    expect(next.state.currentPickNo).toBe(3)
  })

  it("keeps a newer state over an older snapshot of the same draft", () => {
    const live = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1)],
    })
    const next = liveReducer(live, {
      type: "snapshot",
      snapshot: snapshotOf([created, started]),
    })
    expect(next).toBe(live)
  })

  it("takes the snapshot of another draft whatever its seq", () => {
    const live = liveReducer(fresh(), {
      type: "events",
      events: [pickEvent(1)],
    })
    const other = { ...snapshotOf([created]), draftId: "draft-2" }
    expect(
      liveReducer(live, { type: "snapshot", snapshot: other }).draftId
    ).toBe("draft-2")
  })

  it("takes an equal snapshot, which carries the names", () => {
    const next = liveReducer(fresh(), {
      type: "snapshot",
      snapshot: snapshotOf([created, started], [...PLAYERS, info("x", "X")]),
    })
    expect(next.players).toHaveLength(PLAYERS.length + 1)
  })
})

describe("isGap and unknownUserIds", () => {
  it("only picks and undos can show a gap", () => {
    const state = replayDraft([created, started])
    expect(isGap(state, pickEvent(1))).toBe(false)
    expect(isGap(state, pickEvent(2))).toBe(true)
    expect(
      isGap(state, {
        seq: 5,
        type: "paused",
        actorUserId: null,
        at: "x",
        payload: {},
      })
    ).toBe(false)
  })

  it("lists captains, pool users and pickers without info, once", () => {
    const state = replayDraft([created, started, pickEvent(1)])
    expect(unknownUserIds(state, PLAYERS)).toEqual([])
    expect(
      unknownUserIds(
        state,
        PLAYERS.filter((p) => p.userId !== "p0" && p.userId !== "c0")
      ).sort()
    ).toEqual(["c0", "p0"])
  })
})
