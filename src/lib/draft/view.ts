import { slotFor } from "./order"
import type {
  DraftPlayerInfo,
  DraftPoolState,
  DraftSlotState,
  DraftState,
} from "./types"

/**
 * Derived views of a draft for the room: whose turn it is, rosters, and the
 * filtered pool. Pure, so the components stay thin and these are unit tested.
 */

export const POOL_SORTS = ["rating", "name"] as const
export type PoolSort = (typeof POOL_SORTS)[number]

export const DRAFT_TABS = ["pool", "teams", "log"] as const
export type DraftTab = (typeof DRAFT_TABS)[number]

export function isPoolSort(value: unknown): value is PoolSort {
  return POOL_SORTS.includes(value as PoolSort)
}

export function isDraftTab(value: unknown): value is DraftTab {
  return DRAFT_TABS.includes(value as DraftTab)
}

/** The name to show for a player; deleted accounts have no info at all. */
export function playerLabel(info: DraftPlayerInfo | undefined): string {
  return info?.runescapeName || info?.name || "Unknown player"
}

/** 0..1 as a whole number out of 100, or null for an unrated player. */
export function ratingPoints(rating: number | null): number | null {
  return rating === null ? null : Math.round(rating * 100)
}

/**
 * The slot that picks next, or null when no pick is due (the draft has not
 * started, is complete or cancelled). A paused draft still names its slot.
 */
export function onTurnSlot(state: DraftState): DraftSlotState | null {
  if (state.status !== "in_progress" && state.status !== "paused") return null
  if (state.slots.length === 0 || !state.permutation) return null
  const position = slotFor(
    state.currentPickNo,
    state.slots.length,
    state.orderType,
    state.permutation
  )
  return state.slots.find((slot) => slot.position === position) ?? null
}

export function currentRound(state: DraftState): number {
  if (state.slots.length === 0) return 1
  return Math.floor((state.currentPickNo - 1) / state.slots.length) + 1
}

export function totalPickCount(state: DraftState): number {
  return state.rounds * state.slots.length
}

export interface RosterEntry {
  userId: string | null
  /** Pick number; null for the captain. */
  pickNo: number | null
  round: number | null
  captain: boolean
  rating: number | null
  auto: boolean
  forced: boolean
}

/** The captain followed by the players the slot picked, in pick order. */
export function rosterOf(
  state: DraftState,
  slot: DraftSlotState
): RosterEntry[] {
  const ratingOf = new Map(state.pool.map((p) => [p.poolEntryId, p.rating]))
  return [
    {
      userId: slot.captainUserId,
      pickNo: null,
      round: null,
      captain: true,
      rating: null,
      auto: false,
      forced: false,
    },
    ...state.picks
      .filter((pick) => pick.slotId === slot.slotId)
      .map((pick) => ({
        userId: pick.userId,
        pickNo: pick.pickNo,
        round: pick.round,
        captain: false,
        rating: ratingOf.get(pick.poolEntryId) ?? null,
        auto: pick.auto,
        forced: pick.forced,
      })),
  ]
}

export interface PoolFilter {
  q: string
  /** A skill level, or "" for any. */
  skill: string
  sort: PoolSort
}

/** Available players matching the search and skill filter, sorted. */
export function filterPool(
  pool: readonly DraftPoolState[],
  players: ReadonlyMap<string, DraftPlayerInfo>,
  filter: PoolFilter
): DraftPoolState[] {
  const needle = filter.q.trim().toLowerCase()
  const label = (entry: DraftPoolState) =>
    playerLabel(entry.userId ? players.get(entry.userId) : undefined)
  const matches = pool.filter((entry) => {
    if (entry.status !== "available") return false
    const info = entry.userId ? players.get(entry.userId) : undefined
    if (filter.skill && info?.skillLevel !== filter.skill) return false
    if (!needle) return true
    return (
      label(entry).toLowerCase().includes(needle) ||
      (info?.name ?? "").toLowerCase().includes(needle)
    )
  })
  const byName = (a: DraftPoolState, b: DraftPoolState) =>
    label(a).localeCompare(label(b), undefined, { sensitivity: "base" })
  return matches.sort((a, b) => {
    if (filter.sort === "name") return byName(a, b)
    // Highest rating first, unrated last, ties by name.
    if (a.rating === null && b.rating !== null) return 1
    if (a.rating !== null && b.rating === null) return -1
    if (a.rating !== null && b.rating !== null && a.rating !== b.rating) {
      return b.rating - a.rating
    }
    return byName(a, b)
  })
}
