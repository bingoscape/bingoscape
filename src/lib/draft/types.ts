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
  }
  paused: Record<string, never>
  resumed: Record<string, never>
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
  }
  undo: { pickNo: number; slotId: string; poolEntryId: string }
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
}

export interface DraftPoolState {
  poolEntryId: string
  userId: string | null
  status: DraftPoolStatus
  rating: number | null
  ratingSource: string
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
}

/** The user data the views need; kept out of the events so it can change. */
export interface DraftPlayerInfo {
  userId: string
  name: string | null
  runescapeName: string | null
  image: string | null
  skillLevel: string | null
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
  state: DraftState
  /** Names and avatars of everyone in the state (captains, pool, pickers). */
  players: DraftPlayerInfo[]
}
