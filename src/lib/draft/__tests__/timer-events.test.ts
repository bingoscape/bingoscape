/**
 * @jest-environment node
 *
 * The timer parts of the reducer, the live reducer and the derived views
 * (team draft 3/4, #217).
 */
import { liveReducer, initialLiveState } from "@/lib/draft/live"
import { applyDraftEvent, replayDraft } from "@/lib/draft/reducer"
import type { DraftLogEvent } from "@/lib/draft/types"
import {
  awaySlots,
  draftedWhoLeft,
  rosterOf,
  unassignedPlayers,
} from "@/lib/draft/view"
import {
  created,
  pickEvent,
  snapshotOf,
  started,
} from "@/lib/draft/__tests__/draft-fixtures"

const AT = "2026-01-01T00:00:00.000Z"
const DEADLINE = "2026-01-01T00:00:30.000Z"

const timed = (event: DraftLogEvent): DraftLogEvent =>
  ({
    ...event,
    payload: {
      ...event.payload,
      deadline: DEADLINE,
      serverNow: AT,
      pausedRemainingMs: null,
    },
  }) as DraftLogEvent

const at = (event: Omit<DraftLogEvent, "actorUserId" | "at">) =>
  ({ actorUserId: "manager", at: AT, ...event }) as DraftLogEvent

describe("reducer: timer fields", () => {
  it("takes the deadline from the start and from every pick", () => {
    const afterStart = replayDraft([created, timed(started)])
    expect(afterStart.deadline).toBe(DEADLINE)
    expect(afterStart.serverNow).toBe(AT)

    const next = "2026-01-01T00:01:00.000Z"
    const afterPick = applyDraftEvent(afterStart, {
      ...pickEvent(1),
      payload: {
        ...pickEvent(1).payload,
        deadline: next,
        serverNow: "2026-01-01T00:00:10.000Z",
        consecutiveTimeouts: 0,
      },
    } as DraftLogEvent)
    expect(afterPick.deadline).toBe(next)
    expect(afterPick.serverNow).toBe("2026-01-01T00:00:10.000Z")
  })

  it("keeps the old deadline for events logged before the timer existed", () => {
    const state = replayDraft([created, started, pickEvent(1)])
    expect(state.deadline).toBeNull()
    expect(state.pausedRemainingMs).toBeNull()
  })

  it("pause freezes the remaining time and resume restores a deadline", () => {
    const running = replayDraft([created, timed(started)])
    const paused = applyDraftEvent(
      running,
      at({
        seq: 10,
        type: "paused",
        payload: {
          reason: "manual",
          deadline: null,
          serverNow: "2026-01-01T00:00:12.000Z",
          pausedRemainingMs: 18_000,
        },
      })
    )
    expect(paused.status).toBe("paused")
    expect(paused.deadline).toBeNull()
    expect(paused.pausedRemainingMs).toBe(18_000)

    const resumed = applyDraftEvent(
      paused,
      at({
        seq: 11,
        type: "resumed",
        payload: {
          deadline: "2026-01-01T00:05:18.000Z",
          serverNow: "2026-01-01T00:05:00.000Z",
          pausedRemainingMs: null,
        },
      })
    )
    expect(resumed.status).toBe("in_progress")
    expect(resumed.deadline).toBe("2026-01-01T00:05:18.000Z")
    expect(resumed.pausedRemainingMs).toBeNull()
  })

  it("a timer event re-arms the deadline without another change", () => {
    const state = applyDraftEvent(
      replayDraft([created, started]),
      at({
        seq: 10,
        type: "timer",
        payload: { deadline: DEADLINE, serverNow: AT, pausedRemainingMs: null },
      })
    )
    expect(state.status).toBe("in_progress")
    expect(state.deadline).toBe(DEADLINE)
  })

  it("clears the deadline when the draft completes or is cancelled", () => {
    const running = replayDraft([created, timed(started)])
    expect(
      applyDraftEvent(running, at({ seq: 10, type: "completed", payload: {} }))
        .deadline
    ).toBeNull()
    expect(
      applyDraftEvent(
        running,
        at({
          seq: 10,
          type: "cancelled",
          payload: { deletedTeamIds: [], keptTeamIds: [] },
        })
      ).deadline
    ).toBeNull()
  })

  it("a skipped turn moves the pick on and counts the timeout", () => {
    const state = applyDraftEvent(
      replayDraft([created, started]),
      at({
        seq: 10,
        type: "skipped",
        payload: {
          pickNo: 1,
          slotId: "s0",
          reason: "timer_skip",
          consecutiveTimeouts: 1,
          deadline: DEADLINE,
          serverNow: AT,
        },
      })
    )
    expect(state.currentPickNo).toBe(2)
    expect(
      state.slots.find((s) => s.slotId === "s0")!.consecutiveTimeouts
    ).toBe(1)
    expect(state.deadline).toBe(DEADLINE)
    expect(state.picks).toEqual([])
  })

  it("a pick carries the slot's timeout streak, and undo restores it", () => {
    const base = replayDraft([created, started])
    const autoPick = applyDraftEvent(base, {
      ...pickEvent(1),
      actorUserId: null,
      payload: {
        ...pickEvent(1).payload,
        auto: true,
        reason: "timer_auto",
        consecutiveTimeouts: 2,
      },
    } as DraftLogEvent)
    expect(
      autoPick.slots.find((s) => s.slotId === "s0")!.consecutiveTimeouts
    ).toBe(2)
    expect(autoPick.picks[0]).toMatchObject({
      auto: true,
      reason: "timer_auto",
    })

    const undone = applyDraftEvent(
      autoPick,
      at({
        seq: 20,
        type: "undo",
        payload: {
          pickNo: 1,
          slotId: "s0",
          poolEntryId: "e0",
          consecutiveTimeouts: 1,
          deadline: DEADLINE,
          serverNow: AT,
        },
      })
    )
    expect(
      undone.slots.find((s) => s.slotId === "s0")!.consecutiveTimeouts
    ).toBe(1)
    expect(undone.currentPickNo).toBe(1)
    expect(undone.deadline).toBe(DEADLINE)
  })
})

describe("live reducer with skipped turns", () => {
  const live = () =>
    initialLiveState(snapshotOf([created, started, pickEvent(1)]))

  it("applies a skipped turn that follows the current pick", () => {
    const next = liveReducer(live(), {
      type: "events",
      events: [
        at({
          seq: 20,
          type: "skipped",
          payload: { pickNo: 2, slotId: "s1", reason: "team_full" },
        }),
      ],
    })
    expect(next.needsResync).toBe(false)
    expect(next.state.currentPickNo).toBe(3)
  })

  it("treats a skipped turn that does not follow as a gap", () => {
    const next = liveReducer(live(), {
      type: "events",
      events: [
        at({
          seq: 20,
          type: "skipped",
          payload: { pickNo: 5, slotId: "s1", reason: "team_full" },
        }),
      ],
    })
    expect(next.needsResync).toBe(true)
  })

  it("accepts an undo of the last pick even when turns were skipped after it", () => {
    let state = live()
    state = liveReducer(state, {
      type: "events",
      events: [
        at({
          seq: 20,
          type: "skipped",
          payload: { pickNo: 2, slotId: "s1", reason: "timer_skip" },
        }),
      ],
    })
    state = liveReducer(state, {
      type: "events",
      events: [
        at({
          seq: 21,
          type: "undo",
          payload: { pickNo: 1, slotId: "s0", poolEntryId: "e0" },
        }),
      ],
    })
    expect(state.needsResync).toBe(false)
    expect(state.state.currentPickNo).toBe(1)
    expect(state.state.picks).toEqual([])
  })

  it("keeps the late joiners of the snapshot", () => {
    const snapshot = {
      ...snapshotOf([created, started]),
      lateJoiners: ["late"],
    }
    expect(initialLiveState(snapshot).lateJoiners).toEqual(["late"])
  })
})

describe("views", () => {
  it("flags captains who timed out repeatedly", () => {
    const state = replayDraft([
      created,
      started,
      at({
        seq: 10,
        type: "skipped",
        payload: {
          pickNo: 1,
          slotId: "s0",
          reason: "timer_skip",
          consecutiveTimeouts: 1,
        },
      }),
    ])
    expect(awaySlots(state)).toEqual([])
    const away = applyDraftEvent(
      state,
      at({
        seq: 11,
        type: "skipped",
        payload: {
          pickNo: 2,
          slotId: "s0",
          reason: "timer_skip",
          consecutiveTimeouts: 2,
        },
      })
    )
    expect(awaySlots(away).map((s) => s.slotId)).toEqual(["s0"])
  })

  it("reports drafted players who left the event, and unassigned players", () => {
    const state = replayDraft([
      created,
      started,
      pickEvent(1),
      pickEvent(2),
      pickEvent(3),
      pickEvent(4),
      at({ seq: 20, type: "completed", payload: {} }),
    ])
    expect(draftedWhoLeft(state)).toEqual([])
    const withLeft = {
      ...state,
      pool: state.pool.map((e) =>
        e.poolEntryId === "e1" ? { ...e, leftEvent: true } : e
      ),
    }
    expect(draftedWhoLeft(withLeft).map((e) => e.poolEntryId)).toEqual(["e1"])
    expect(
      rosterOf(withLeft, withLeft.slots[1]!).find((r) => r.userId === "p1")!
        .leftEvent
    ).toBe(true)

    // Nobody is left in the pool, so only the late joiners are unassigned.
    expect(unassignedPlayers(state, ["late"])).toEqual([
      { userId: "late", kind: "late_joiner" },
    ])
  })

  it("lists unpicked players of a complete draft, but not those who left", () => {
    const state = replayDraft([
      created,
      started,
      pickEvent(1),
      at({ seq: 20, type: "completed", payload: {} }),
    ])
    const marked = {
      ...state,
      pool: state.pool.map((e) =>
        e.poolEntryId === "e3" ? { ...e, leftEvent: true } : e
      ),
    }
    expect(unassignedPlayers(marked, [])).toEqual([
      { userId: "p1", kind: "not_picked" },
      { userId: "p2", kind: "not_picked" },
    ])
    // While the draft runs, the pool is not "unassigned".
    const running = replayDraft([created, started, pickEvent(1)])
    expect(unassignedPlayers(running, ["late"])).toEqual([
      { userId: "late", kind: "late_joiner" },
    ])
  })
})
