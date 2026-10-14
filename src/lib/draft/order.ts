import type { DraftOrderType } from "./types"

/**
 * Pick order. Slot positions are 0-based places in the setup order; picks are
 * 1-based and numbered across the whole draft. Pure and deterministic.
 */

/** 1-based round of a 1-based pick number. */
export function roundOf(pickNo: number, slotCount: number): number {
  assertInput(pickNo, slotCount)
  return Math.floor((pickNo - 1) / slotCount) + 1
}

/** Number of picks of a draft that runs all its rounds. */
export function totalPicks(rounds: number, slotCount: number): number {
  return rounds * slotCount
}

/** The order of slots at the start: 0, 1, ..., n-1. */
export function identityPermutation(slotCount: number): number[] {
  return Array.from({ length: slotCount }, (_, i) => i)
}

/**
 * mulberry32: a tiny seeded PRNG. The seed alone is not what makes a draft
 * auditable (the permutation is stored with it), so swapping this out later
 * does not change a draft that already started.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** A seeded Fisher-Yates shuffle of 0..n-1. The same seed gives the same order. */
export function seededPermutation(seed: number, slotCount: number): number[] {
  const order = identityPermutation(slotCount)
  const random = mulberry32(seed)
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    const swap = order[i]!
    order[i] = order[j]!
    order[j] = swap
  }
  return order
}

/** True for an array that holds each of 0..n-1 exactly once. */
export function isPermutation(value: unknown, slotCount: number): boolean {
  if (!Array.isArray(value) || value.length !== slotCount) return false
  const seen = new Set<number>()
  for (const entry of value) {
    if (!Number.isInteger(entry) || entry < 0 || entry >= slotCount)
      return false
    seen.add(entry as number)
  }
  return seen.size === slotCount
}

/**
 * The slot position that picks `pickNo`.
 *
 * - `linear`: the same order every round.
 * - `snake`: the order reverses on every even round.
 * - `random_snake`: a snake over the seeded permutation `permutation`.
 *
 * `permutation[i]` is the slot position at order index `i`; it defaults to the
 * identity and is required for `random_snake` (the shuffle belongs to the
 * start of the draft and is stored in the `started` event).
 */
export function slotFor(
  pickNo: number,
  slotCount: number,
  orderType: DraftOrderType,
  permutation?: readonly number[] | null
): number {
  assertInput(pickNo, slotCount)
  if (orderType === "random_snake" && !permutation) {
    throw new Error("random_snake needs the seed permutation")
  }
  if (permutation && !isPermutation(permutation, slotCount)) {
    throw new Error("The permutation does not match the number of slots")
  }

  const round = roundOf(pickNo, slotCount)
  const index = (pickNo - 1) % slotCount
  const reversed = orderType !== "linear" && round % 2 === 0
  const orderIndex = reversed ? slotCount - 1 - index : index
  return permutation ? permutation[orderIndex]! : orderIndex
}

/** Every pick of a draft as `{ pickNo, round, position }`, for previews. */
export function pickSchedule(
  rounds: number,
  slotCount: number,
  orderType: DraftOrderType,
  permutation?: readonly number[] | null
): { pickNo: number; round: number; position: number }[] {
  const total = totalPicks(rounds, slotCount)
  return Array.from({ length: total }, (_, i) => ({
    pickNo: i + 1,
    round: roundOf(i + 1, slotCount),
    position: slotFor(i + 1, slotCount, orderType, permutation),
  }))
}

function assertInput(pickNo: number, slotCount: number): void {
  if (!Number.isInteger(pickNo) || pickNo < 1) {
    throw new RangeError("pickNo must be an integer >= 1")
  }
  if (!Number.isInteger(slotCount) || slotCount < 1) {
    throw new RangeError("slotCount must be an integer >= 1")
  }
}
