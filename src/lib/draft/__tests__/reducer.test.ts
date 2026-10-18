/**
 * @jest-environment node
 */
import {
  applyDraftEvent,
  applyDraftEvents,
  emptyDraftState,
  replayDraft,
} from "@/lib/draft/reducer"
import type { DraftLogEvent } from "@/lib/draft/types"

const AT = "2026-01-01T00:00:00.000Z"

const created: DraftLogEvent = {
  seq: 1,
  type: "created",
  actorUserId: "manager",
  at: AT,
  payload: {
    orderType: "snake",
    rounds: 2,
    pickTimerSeconds: null,
    onTimeout: "auto_pick",
    autoPickRule: "best_rated",
    slots: [
      {
        slotId: "s0",
        position: 0,
        captainUserId: "c0",
        teamName: "A",
        maxTeamSize: 3,
      },
      {
        slotId: "s1",
        position: 1,
        captainUserId: "c1",
        teamName: "B",
        maxTeamSize: 3,
      },
    ],
  },
}

const started: DraftLogEvent = {
  seq: 2,
  type: "started",
  actorUserId: "manager",
  at: AT,
  payload: {
    seed: 7,
    permutation: [0, 1],
    slots: [
      { slotId: "s0", teamId: "t0" },
      { slotId: "s1", teamId: "t1" },
    ],
    pool: [
      { poolEntryId: "p0", userId: "u0", rating: 0.9, ratingSource: "x" },
      { poolEntryId: "p1", userId: "u1", rating: null, ratingSource: "x" },
      { poolEntryId: "p2", userId: "u2", rating: 0.1, ratingSource: "x" },
      { poolEntryId: "p3", userId: "u3", rating: 0.5, ratingSource: "x" },
    ],
  },
}

const pick = (
  seq: number,
  pickNo: number,
  slotId: string,
  poolEntryId: string,
  actorUserId = "c0"
): DraftLogEvent => ({
  seq,
  type: "pick",
  actorUserId,
  at: AT,
  payload: {
    pickNo,
    round: Math.ceil(pickNo / 2),
    slotId,
    poolEntryId,
    userId: `u${poolEntryId.slice(1)}`,
    auto: false,
    forced: false,
    reason: null,
  },
})

const LOG: DraftLogEvent[] = [
  created,
  started,
  pick(3, 1, "s0", "p0"),
  pick(4, 2, "s1", "p1", "c1"),
  pick(5, 3, "s1", "p2", "c1"),
  pick(6, 4, "s0", "p3"),
  { seq: 7, type: "completed", actorUserId: null, at: AT, payload: {} },
]

describe("draft reducer", () => {
  it("builds the state from the log", () => {
    const state = replayDraft(LOG)
    expect(state.status).toBe("complete")
    expect(state.currentPickNo).toBe(5)
    expect(state.lastSeq).toBe(7)
    expect(state.permutation).toEqual([0, 1])
    expect(state.slots.map((s) => s.teamId)).toEqual(["t0", "t1"])
    expect(state.pool.every((p) => p.status === "drafted")).toBe(true)
    expect(state.picks.map((p) => [p.pickNo, p.slotId])).toEqual([
      [1, "s0"],
      [2, "s1"],
      [3, "s1"],
      [4, "s0"],
    ])
    expect(state.picks[1]!.pickedBy).toBe("c1")
  })

  it("starts from an empty setup state", () => {
    expect(emptyDraftState().status).toBe("setup")
    const state = applyDraftEvent(emptyDraftState(), created)
    expect(state.status).toBe("setup")
    expect(state.slots).toHaveLength(2)
    expect(state.pool).toEqual([])
  })

  it("is idempotent: replaying events it has already seen changes nothing", () => {
    const once = replayDraft(LOG)
    expect(applyDraftEvents(once, LOG)).toEqual(once)
    expect(applyDraftEvent(once, LOG[3]!)).toBe(once)
  })

  it("ignores an overlapping page of catch-up events", () => {
    const upToPick2 = replayDraft(LOG.slice(0, 4))
    const overlapping = applyDraftEvents(upToPick2, LOG.slice(2))
    expect(overlapping).toEqual(replayDraft(LOG))
  })

  it("applies events by seq even when they arrive out of order", () => {
    const shuffled = [...LOG].reverse()
    expect(applyDraftEvents(emptyDraftState(), shuffled)).toEqual(
      replayDraft(LOG)
    )
  })

  it("does not mutate the previous state", () => {
    const before = replayDraft(LOG.slice(0, 3))
    const snapshot = JSON.parse(JSON.stringify(before))
    applyDraftEvent(before, LOG[3]!)
    expect(before).toEqual(snapshot)
  })

  it("undo returns the player to the pool, rewinds the pick and reopens a completed draft", () => {
    const undone = applyDraftEvent(replayDraft(LOG), {
      seq: 8,
      type: "undo",
      actorUserId: "manager",
      at: AT,
      payload: { pickNo: 4, slotId: "s0", poolEntryId: "p3" },
    })
    expect(undone.status).toBe("in_progress")
    expect(undone.currentPickNo).toBe(4)
    expect(undone.picks.map((p) => p.pickNo)).toEqual([1, 2, 3])
    expect(undone.pool.find((p) => p.poolEntryId === "p3")!.status).toBe(
      "available"
    )
  })

  it("follows pause, resume, cancel and apply", () => {
    const base = replayDraft(LOG.slice(0, 3))
    const at = (seq: number, type: "paused" | "resumed") =>
      ({ seq, type, actorUserId: "m", at: AT, payload: {} }) as DraftLogEvent
    const paused = applyDraftEvent(base, at(10, "paused"))
    expect(paused.status).toBe("paused")
    expect(applyDraftEvent(paused, at(11, "resumed")).status).toBe(
      "in_progress"
    )
    expect(
      applyDraftEvent(base, {
        seq: 12,
        type: "cancelled",
        actorUserId: "m",
        at: AT,
        payload: { deletedTeamIds: ["t0", "t1"], keptTeamIds: [] },
      }).status
    ).toBe("cancelled")
    const applied = applyDraftEvent(replayDraft(LOG), {
      seq: 13,
      type: "applied",
      actorUserId: "m",
      at: AT,
      payload: { applied: ["u0"], skipped: [] },
    })
    expect(applied.applied).toBe(true)
  })
})
