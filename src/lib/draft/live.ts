import { applyDraftEvent } from "./reducer"
import type {
  DraftLogEvent,
  DraftPlayerInfo,
  DraftSnapshot,
  DraftState,
} from "./types"

/**
 * What the draft room holds on the client in the live phase (team draft 2/4,
 * #216): the shared reducer's state, fed by the stream, the polling fallback
 * and the snapshots of the server. Pure, so the hook around it
 * (`use-draft-stream`) stays thin and the rules are unit tested.
 *
 * Three rules keep it correct whatever order things arrive in:
 * - an event at or below `state.lastSeq` is dropped (duplicates, replays that
 *   overlap what the client has, out of order delivery);
 * - an event that does not follow from the state (a pick that is not the
 *   current one, an undo of another pick) means events were missed:
 *   `needsResync` is set and the hook refetches the snapshot; `seq` cannot
 *   show this because it is one identity for all drafts and has holes;
 * - a snapshot replaces the state unless it is older than it.
 */

export interface DraftLiveState {
  draftId: string
  version: number
  state: DraftState
  players: DraftPlayerInfo[]
  /** Joined the Event after the draft started (from the last snapshot). */
  lateJoiners: string[]
  /** Events were missed or a name is unknown: refetch the snapshot. */
  needsResync: boolean
}

export type DraftLiveAction =
  | { type: "events"; events: readonly DraftLogEvent[] }
  | { type: "snapshot"; snapshot: DraftSnapshot }

export function initialLiveState(snapshot: DraftSnapshot): DraftLiveState {
  return {
    draftId: snapshot.draftId,
    version: snapshot.version,
    state: snapshot.state,
    players: snapshot.players,
    lateJoiners: snapshot.lateJoiners,
    needsResync: false,
  }
}

/** True when `event` cannot be the next event of `state`: something was missed. */
export function isGap(state: DraftState, event: DraftLogEvent): boolean {
  switch (event.type) {
    case "pick":
      return event.payload.pickNo !== state.currentPickNo
    case "skipped":
      return event.payload.pickNo !== state.currentPickNo
    case "undo":
      // Skipped turns may sit between the last pick and the current one.
      return state.picks.at(-1)?.pickNo !== event.payload.pickNo
    default:
      return false
  }
}

/** Users the state refers to that `players` has no name for. */
export function unknownUserIds(
  state: DraftState,
  players: readonly DraftPlayerInfo[]
): string[] {
  const known = new Set(players.map((p) => p.userId))
  const referenced = [
    ...state.slots.map((s) => s.captainUserId),
    ...state.pool.map((p) => p.userId),
    ...state.picks.map((p) => p.pickedBy),
  ]
  return [
    ...new Set(
      referenced.filter((id): id is string => id !== null && !known.has(id))
    ),
  ]
}

export function liveReducer(
  live: DraftLiveState,
  action: DraftLiveAction
): DraftLiveState {
  switch (action.type) {
    case "events": {
      let state = live.state
      let gap = false
      const sorted = [...action.events].sort((a, b) => a.seq - b.seq)
      for (const event of sorted) {
        if (event.seq <= state.lastSeq) continue
        if (isGap(state, event)) {
          gap = true
          break
        }
        state = applyDraftEvent(state, event)
      }
      if (state === live.state && !gap) return live
      const needsResync =
        live.needsResync ||
        gap ||
        unknownUserIds(state, live.players).length > 0
      return { ...live, state, needsResync }
    }
    case "snapshot": {
      const { snapshot } = action
      if (
        snapshot.draftId === live.draftId &&
        snapshot.state.lastSeq < live.state.lastSeq
      ) {
        return live
      }
      return initialLiveState(snapshot)
    }
  }
}
