import { replayDraft } from "@/lib/draft/reducer"
import type {
  DraftLogEvent,
  DraftPlayerInfo,
  DraftSnapshot,
} from "@/lib/draft/types"

/** A two-team draft: captains c0/c1, players p0..p3 (pool entries e0..e3). */

const AT = "2026-01-01T00:00:00.000Z"

export const created: DraftLogEvent = {
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
    slots: [0, 1].map((i) => ({
      slotId: `s${i}`,
      position: i,
      captainUserId: `c${i}`,
      teamName: `Team ${i + 1}`,
      maxTeamSize: 3,
    })),
  },
}

export const started: DraftLogEvent = {
  seq: 2,
  type: "started",
  actorUserId: "manager",
  at: AT,
  payload: {
    seed: 1,
    permutation: [0, 1],
    slots: [0, 1].map((i) => ({ slotId: `s${i}`, teamId: `t${i}` })),
    pool: [0, 1, 2, 3].map((i) => ({
      poolEntryId: `e${i}`,
      userId: `p${i}`,
      rating: i === 3 ? null : 0.9 - i * 0.2,
      ratingSource: "team_balancing_v1",
    })),
  },
}

const PICK_ORDER = ["s0", "s1", "s1", "s0"]

/** Pick `pickNo` (snake over two teams: s0, s1, s1, s0) of pool entry e<pickNo-1>. */
export function pickEvent(
  pickNo: number,
  overrides: { seq?: number; actorUserId?: string | null } = {}
): DraftLogEvent {
  const slotId = PICK_ORDER[pickNo - 1]!
  return {
    seq: overrides.seq ?? 2 + pickNo,
    type: "pick",
    actorUserId: overrides.actorUserId ?? (slotId === "s0" ? "c0" : "c1"),
    at: AT,
    payload: {
      pickNo,
      round: Math.ceil(pickNo / 2),
      slotId,
      poolEntryId: `e${pickNo - 1}`,
      userId: `p${pickNo - 1}`,
      auto: false,
      forced: false,
      reason: null,
    },
  }
}

export const info = (userId: string, name: string): DraftPlayerInfo => ({
  userId,
  name,
  runescapeName: null,
  image: null,
  skillLevel: null,
})

export const PLAYERS: DraftPlayerInfo[] = [
  info("c0", "Captain One"),
  info("c1", "Captain Two"),
  info("p0", "Alice"),
  info("p1", "Bob"),
  info("p2", "Carol"),
  info("p3", "Dave"),
  info("manager", "Manager"),
]

export function snapshotOf(
  events: DraftLogEvent[],
  players: DraftPlayerInfo[] = PLAYERS
): DraftSnapshot {
  return {
    draftId: "draft-1",
    eventId: "event-1",
    version: 1,
    state: replayDraft(events),
    players,
  }
}
