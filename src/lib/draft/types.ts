import type {
  DraftAutoPickRule,
  DraftOnTimeout,
  DraftOrderType,
  DraftPoolStatus,
  DraftStatus,
} from "./constants"

/**
 * Shapes shared by the server, the state endpoint and the client reducer.
 * Pure types: safe to import from client components.
 */

export type {
  DraftAutoPickRule,
  DraftOnTimeout,
  DraftOrderType,
  DraftPoolStatus,
  DraftStatus,
}

/** The statuses in which picks can still happen. */
export const ACTIVE_DRAFT_STATUSES = [
  "in_progress",
  "paused",
] as const satisfies readonly DraftStatus[]

// ---------------------------------------------------------------------------
// Log events (`draft_event`)
// ---------------------------------------------------------------------------

export interface DraftSlotInit {
  slotId: string
  position: number
  captainUserId: string | null
  teamName: string
  maxTeamSize: number
}

export interface DraftPoolInit {
  poolEntryId: string
  userId: string | null
  /** 0..1; null: unrated. */
  rating: number | null
  ratingSource: string
}

/**
 * What the pick timer looked like after an event. `deadline` and `serverNow`
 * are the database clock (never the client's): the client counts down using
 * the offset between `serverNow` and its own clock. Absent on events logged
 * before the timer existed.
 */
export interface DraftTimerFields {
  /** ISO time the on-turn captain's turn ends; null: no timer or paused. */
  deadline?: string | null
  /** ISO database time when the event was written. */
  serverNow?: string
  /** Time left on the turn while the draft is paused. */
  pausedRemainingMs?: number | null
}

/** Why a pick was made without the captain choosing it, or a turn was skipped. */
export type DraftPickReason = "forced" | "timer_auto" | "timer_queue"
export type DraftSkipReason = "timer_skip" | "manual_skip" | "team_full"

export interface DraftEventPayloads {
  created: {
    orderType: DraftOrderType
    rounds: number
    pickTimerSeconds: number | null
    onTimeout: DraftOnTimeout
    autoPickRule: DraftAutoPickRule
    slots: DraftSlotInit[]
  }
  /**
   * The seed and the resulting permutation are both stored, so the order stays
   * auditable whatever the PRNG implementation is later: `permutation[i]` is
   * the slot position at order index `i`.
   */
  started: {
    seed: number
    permutation: number[]
    slots: { slotId: string; teamId: string }[]
    pool: DraftPoolInit[]
  } & DraftTimerFields
  /** `reason: "timer"`: the timer ran out and the draft is set to pause on timeout. */
  paused: { reason?: "manual" | "timer" } & DraftTimerFields
  /** The deadline was armed or re-armed without another change (e.g. after a deploy). */
  timer: DraftTimerFields
  resumed: DraftTimerFields
  /** Teams the draft created: deleted when they held nothing but the captain. */
  cancelled: { deletedTeamIds: string[]; keptTeamIds: string[] }
  pick: {
    pickNo: number
    round: number
    slotId: string
    poolEntryId: string
    userId: string | null
    auto: boolean
    /** A manager picked for the captain. */
    forced: boolean
    reason: string | null
    /** The slot's timeouts in a row after this pick (0 after a manual pick). */
    consecutiveTimeouts?: number
  } & DraftTimerFields
  /**
   * A turn that passed without a pick: the timer ran out (`on_timeout: skip`),
   * a manager skipped it, or the team was already full. Advances the pick.
   */
  skipped: {
    pickNo: number
    slotId: string
    reason: DraftSkipReason
    consecutiveTimeouts?: number
  } & DraftTimerFields
  undo: {
    pickNo: number
    slotId: string
    poolEntryId: string
    consecutiveTimeouts?: number
  } & DraftTimerFields
  completed: Record<string, never>
  applied: { applied: string[]; skipped: string[] }
}

export type DraftEventType = keyof DraftEventPayloads

export type DraftLogEvent = {
  [T in DraftEventType]: {
    seq: number
    type: T
    actorUserId: string | null
    /** ISO timestamp. */
    at: string
    payload: DraftEventPayloads[T]
  }
}[DraftEventType]

// ---------------------------------------------------------------------------
// State (what the reducer builds from the log, and what the page renders)
// ---------------------------------------------------------------------------

export interface DraftSlotState {
  slotId: string
  position: number
  captainUserId: string | null
  teamName: string
  maxTeamSize: number
  teamId: string | null
  /** Turns in a row the captain let the timer run out. */
  consecutiveTimeouts: number
}

export interface DraftPoolState {
  poolEntryId: string
  userId: string | null
  status: DraftPoolStatus
  rating: number | null
  ratingSource: string
  /** The player left the Event since the pool was frozen (snapshot only). */
  leftEvent?: boolean
  /** Joined the Event after the draft was set up; only before the start. */
  isNew?: boolean
}

export interface DraftPickState {
  pickNo: number
  round: number
  slotId: string
  poolEntryId: string
  userId: string | null
  pickedBy: string | null
  auto: boolean
  forced: boolean
  reason: string | null
  at: string
}

export interface DraftState {
  status: DraftStatus
  orderType: DraftOrderType
  rounds: number
  pickTimerSeconds: number | null
  onTimeout: DraftOnTimeout
  autoPickRule: DraftAutoPickRule
  /** The pick that is due next (1-based). */
  currentPickNo: number
  seed: number | null
  /** Slot positions in order-index order; null until the draft starts. */
  permutation: number[] | null
  slots: DraftSlotState[]
  pool: DraftPoolState[]
  picks: DraftPickState[]
  /** `seq` of the last event applied; events at or below it are ignored. */
  lastSeq: number
  applied: boolean
  /** ISO database time the on-turn captain's turn ends; null: no timer or paused. */
  deadline: string | null
  /** ISO database time of the last timer update (see `DraftTimerFields`). */
  serverNow: string | null
  /** Time left on the turn while the draft is paused. */
  pausedRemainingMs: number | null
}

/** The user data the views need; kept out of the events so it can change. */
export interface DraftPlayerInfo {
  userId: string
  name: string | null
  runescapeName: string | null
  image: string | null
  skillLevel: string | null
  /**
   * Whole hours east of UTC (today's offset of the timezone in the Event's
   * player metadata); absent or null: unknown. The zone itself is not sent.
   */
  utcOffset?: number | null
}

/**
 * The whole draft as the room renders it: the state plus the user data of
 * everyone in it. The Server Component builds it from the tables
 * (`loadDraftSnapshot`), the state endpoint and the stream's `reset` event
 * carry it, and the client keeps it current with `liveReducer`.
 */
export interface DraftSnapshot {
  draftId: string
  eventId: string
  version: number
  /** ISO database time when the snapshot was read: the client's clock reference. */
  serverNow: string
  state: DraftState
  /**
   * Users who joined the Event after the draft started: not in the frozen
   * pool, so they stay "Unassigned" for the manager. Empty before the start.
   */
  lateJoiners: string[]
  /** Names and avatars of everyone in the state (captains, pool, pickers). */
  players: DraftPlayerInfo[]
}
