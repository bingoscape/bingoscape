import type {
  DraftEventPayloads,
  DraftLogEvent,
  DraftPickState,
  DraftState,
  DraftTimerFields,
} from "./types"

/**
 * Turns the draft log into state. Pure and idempotent: an event whose `seq` is
 * not above `state.lastSeq` is ignored, so replaying a log (or a page of it
 * that overlaps what the client already has) changes nothing. The client
 * reuses it in the live phase to apply `?since=` catch-up and pushed events.
 */

export function emptyDraftState(): DraftState {
  return {
    status: "setup",
    orderType: "snake",
    rounds: 1,
    pickTimerSeconds: null,
    onTimeout: "auto_pick",
    autoPickRule: "best_rated",
    currentPickNo: 1,
    seed: null,
    permutation: null,
    slots: [],
    pool: [],
    picks: [],
    lastSeq: 0,
    applied: false,
    deadline: null,
    serverNow: null,
    pausedRemainingMs: null,
  }
}

/**
 * The timer part of an event. A field the event does not carry (events logged
 * before the timer existed) leaves the state as it was.
 */
function timerOf(
  state: DraftState,
  p: DraftTimerFields
): Pick<DraftState, "deadline" | "serverNow" | "pausedRemainingMs"> {
  return {
    deadline: p.deadline !== undefined ? p.deadline : state.deadline,
    serverNow: p.serverNow ?? state.serverNow,
    pausedRemainingMs:
      p.pausedRemainingMs !== undefined
        ? p.pausedRemainingMs
        : state.pausedRemainingMs,
  }
}

function withTimeouts(
  state: DraftState,
  slotId: string,
  consecutiveTimeouts: number | undefined
): DraftState["slots"] {
  if (consecutiveTimeouts === undefined) return state.slots
  return state.slots.map((slot) =>
    slot.slotId === slotId ? { ...slot, consecutiveTimeouts } : slot
  )
}

export function applyDraftEvent(
  state: DraftState,
  event: DraftLogEvent
): DraftState {
  if (event.seq <= state.lastSeq) return state
  const next = reduce(state, event)
  return { ...next, lastSeq: event.seq }
}

/** Applies the events in order; events at or below `lastSeq` are skipped. */
export function applyDraftEvents(
  state: DraftState,
  events: readonly DraftLogEvent[]
): DraftState {
  return [...events]
    .sort((a, b) => a.seq - b.seq)
    .reduce(applyDraftEvent, state)
}

export function replayDraft(events: readonly DraftLogEvent[]): DraftState {
  return applyDraftEvents(emptyDraftState(), events)
}

function reduce(state: DraftState, event: DraftLogEvent): DraftState {
  switch (event.type) {
    case "created": {
      const p = event.payload
      return {
        ...state,
        status: "setup",
        orderType: p.orderType,
        rounds: p.rounds,
        pickTimerSeconds: p.pickTimerSeconds,
        onTimeout: p.onTimeout,
        autoPickRule: p.autoPickRule,
        currentPickNo: 1,
        slots: p.slots.map((slot) => ({
          ...slot,
          teamId: null,
          consecutiveTimeouts: 0,
        })),
      }
    }
    case "started": {
      const p = event.payload
      const teamIds = new Map(p.slots.map((s) => [s.slotId, s.teamId]))
      return {
        ...state,
        status: "in_progress",
        ...timerOf(state, p),
        seed: p.seed,
        permutation: p.permutation,
        slots: state.slots.map((slot) => ({
          ...slot,
          teamId: teamIds.get(slot.slotId) ?? slot.teamId,
        })),
        pool: p.pool.map((entry) => ({
          poolEntryId: entry.poolEntryId,
          userId: entry.userId,
          status: "available",
          rating: entry.rating,
          ratingSource: entry.ratingSource,
        })),
      }
    }
    case "paused":
      return {
        ...state,
        status: "paused",
        // Frozen: no deadline until the draft is resumed.
        deadline: null,
        serverNow: event.payload.serverNow ?? state.serverNow,
        pausedRemainingMs: event.payload.pausedRemainingMs ?? null,
      }
    case "timer":
      return { ...state, ...timerOf(state, event.payload) }
    case "resumed":
      return {
        ...state,
        status: "in_progress",
        deadline: event.payload.deadline ?? null,
        serverNow: event.payload.serverNow ?? state.serverNow,
        pausedRemainingMs: null,
      }
    case "cancelled":
      return {
        ...state,
        status: "cancelled",
        deadline: null,
        pausedRemainingMs: null,
      }
    case "completed":
      return {
        ...state,
        status: "complete",
        deadline: null,
        pausedRemainingMs: null,
      }
    case "pick": {
      const p = event.payload
      const pick: DraftPickState = {
        pickNo: p.pickNo,
        round: p.round,
        slotId: p.slotId,
        poolEntryId: p.poolEntryId,
        userId: p.userId,
        pickedBy: event.actorUserId,
        auto: p.auto,
        forced: p.forced,
        reason: p.reason,
        at: event.at,
      }
      return {
        ...state,
        ...timerOf(state, p),
        slots: withTimeouts(state, p.slotId, p.consecutiveTimeouts),
        currentPickNo: p.pickNo + 1,
        picks: [...state.picks.filter((x) => x.pickNo !== p.pickNo), pick].sort(
          (a, b) => a.pickNo - b.pickNo
        ),
        pool: state.pool.map((entry) =>
          entry.poolEntryId === p.poolEntryId
            ? { ...entry, status: "drafted" }
            : entry
        ),
      }
    }
    case "skipped": {
      const p = event.payload
      return {
        ...state,
        ...timerOf(state, p),
        slots: withTimeouts(state, p.slotId, p.consecutiveTimeouts),
        currentPickNo: p.pickNo + 1,
      }
    }
    case "undo": {
      const p: DraftEventPayloads["undo"] = event.payload
      return {
        ...state,
        ...timerOf(state, p),
        slots: withTimeouts(state, p.slotId, p.consecutiveTimeouts),
        // Undoing the pick that completed the draft reopens it.
        status: state.status === "complete" ? "in_progress" : state.status,
        currentPickNo: p.pickNo,
        picks: state.picks.filter((x) => x.pickNo !== p.pickNo),
        pool: state.pool.map((entry) =>
          entry.poolEntryId === p.poolEntryId
            ? { ...entry, status: "available" }
            : entry
        ),
      }
    }
    case "applied":
      return { ...state, applied: true }
  }
}
