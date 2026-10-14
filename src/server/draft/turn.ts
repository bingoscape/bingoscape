import "server-only"

import { and, asc, count, eq, isNull, sql } from "drizzle-orm"

import { roundOf, slotFor, totalPicks } from "@/lib/draft/order"
import type { DraftSkipReason } from "@/lib/draft/types"
import {
  draftPicks,
  draftPoolEntries,
  draftTeamSlots,
  type DraftPoolEntryRow,
  type DraftRow,
  type DraftTeamSlotRow,
} from "@/server/db/schema"
import {
  appendDraftEvent,
  deadlineIn,
  loadPermutation,
  timerPayload,
  updateDraft,
  type DraftTiming,
  type Result,
  type Tx,
} from "./internal"

/**
 * The turn machinery shared by picks, skips and the timer (`expire.ts`): who
 * is on the clock, the advance to the next open turn (a team that reached its
 * `max_team_size` is passed over), completion, and the new deadline. All of it
 * runs under the draft row lock the caller holds.
 */

export interface TurnContext {
  draft: DraftRow
  slots: DraftTeamSlotRow[]
  permutation: number[]
}

export async function loadTurn(tx: Tx, draft: DraftRow): Promise<TurnContext> {
  const slots = await tx
    .select()
    .from(draftTeamSlots)
    .where(eq(draftTeamSlots.draftId, draft.id))
    .orderBy(asc(draftTeamSlots.position))
  const permutation = await loadPermutation(tx, draft.id, slots.length)
  return { draft, slots, permutation }
}

export function slotAt(ctx: TurnContext, pickNo: number): DraftTeamSlotRow {
  const slot =
    ctx.slots[
      slotFor(pickNo, ctx.slots.length, ctx.draft.orderType, ctx.permutation)
    ]
  if (!slot) throw new Error("No slot for the pick")
  return slot
}

/** Picks that stand (undone ones do not count), per slot. */
export async function pickCounts(
  tx: Tx,
  draftId: string
): Promise<Map<string, number>> {
  const rows = await tx
    .select({ slotId: draftPicks.slotId, n: count() })
    .from(draftPicks)
    .where(and(eq(draftPicks.draftId, draftId), isNull(draftPicks.undoneAt)))
    .groupBy(draftPicks.slotId)
  return new Map(rows.map((r) => [r.slotId, r.n]))
}

export async function availableCount(tx: Tx, draftId: string): Promise<number> {
  const [row] = await tx
    .select({ n: count() })
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draftId),
        eq(draftPoolEntries.status, "available")
      )
    )
  return row?.n ?? 0
}

/** The captain counts toward the team size. */
export function isFull(
  slot: Pick<DraftTeamSlotRow, "maxTeamSize">,
  picks: number
): boolean {
  return picks + 1 >= slot.maxTeamSize
}

interface Advance {
  nextPickNo: number
  /** Turns passed over because the team was full. */
  passedOver: { pickNo: number; slotId: string }[]
  completed: boolean
}

/** The first open turn from `from` on; completes when none is left. */
function advance(
  ctx: TurnContext,
  from: number,
  counts: ReadonlyMap<string, number>,
  available: number
): Advance {
  const total = totalPicks(ctx.draft.rounds, ctx.slots.length)
  if (available === 0) {
    return { nextPickNo: from, passedOver: [], completed: true }
  }
  const passedOver: Advance["passedOver"] = []
  let next = from
  while (next <= total) {
    const slot = slotAt(ctx, next)
    if (!isFull(slot, counts.get(slot.id) ?? 0)) break
    passedOver.push({ pickNo: next, slotId: slot.id })
    next += 1
  }
  return { nextPickNo: next, passedOver, completed: next > total }
}

/** Sets the slot's timeout streak and returns the new value. */
async function setTimeouts(
  tx: Tx,
  slot: DraftTeamSlotRow,
  value: number
): Promise<number> {
  const next = Math.max(0, value)
  if (next !== slot.consecutiveTimeouts) {
    await tx
      .update(draftTeamSlots)
      .set({ consecutiveTimeouts: next })
      .where(eq(draftTeamSlots.id, slot.id))
  }
  return next
}

/**
 * Writes the turn change: moves the draft to the next open turn, completes it
 * or arms the next deadline. `logFirst` appends the event that caused the
 * change (the pick or the skip) once the timing is known; the passed-over
 * turns and the completion are logged after it.
 */
async function commitAdvance(
  tx: Tx,
  ctx: TurnContext,
  step: Advance,
  actorUserId: string | null,
  logFirst: (timing: DraftTiming) => Promise<void>
): Promise<boolean> {
  const { draft } = ctx
  const seconds = draft.pickTimerSeconds
  const timing = await updateDraft(tx, draft, {
    currentPickNo: step.nextPickNo,
    ...(step.completed
      ? {
          status: "complete",
          completedAt: sql`now()`,
          turnDeadline: null,
          pausedRemainingMs: null,
        }
      : {
          turnDeadline: seconds ? deadlineIn(seconds) : null,
          pausedRemainingMs: null,
        }),
  })
  if (!timing) throw new Error("The locked draft changed under the turn")

  await logFirst(timing)
  for (const turn of step.passedOver) {
    await appendDraftEvent(tx, draft.id, "skipped", actorUserId, {
      pickNo: turn.pickNo,
      slotId: turn.slotId,
      reason: "team_full",
      ...timerPayload(timing),
    })
  }
  if (step.completed) {
    await appendDraftEvent(tx, draft.id, "completed", actorUserId, {})
  }
  return step.completed
}

export interface CommitPickInput {
  pickNo: number
  slot: DraftTeamSlotRow
  entry: DraftPoolEntryRow
  /** The user who made the pick; null for the timer. */
  actorUserId: string | null
  auto: boolean
  reason: string | null
  /** The captain's timeouts in a row after this pick. */
  consecutiveTimeouts: number
}

/**
 * Records a pick and moves the turn on: the pick row, the pool entry, the
 * slot's timeout streak, the new current pick (passing over full teams), the
 * deadline, and the `pick` / `skipped` / `completed` log events.
 */
export async function commitPick(
  tx: Tx,
  ctx: TurnContext,
  input: CommitPickInput
): Promise<Result<{ pickNo: number; completed: boolean }>> {
  const { draft, slots } = ctx
  const { pickNo, slot, entry } = input

  await tx.insert(draftPicks).values({
    draftId: draft.id,
    pickNo,
    round: roundOf(pickNo, slots.length),
    slotId: slot.id,
    poolEntryId: entry.id,
    pickedBy: input.actorUserId,
    auto: input.auto,
    reason: input.reason,
  })
  await tx
    .update(draftPoolEntries)
    .set({ status: "drafted" })
    .where(eq(draftPoolEntries.id, entry.id))
  const timeouts = await setTimeouts(tx, slot, input.consecutiveTimeouts)

  const counts = await pickCounts(tx, draft.id)
  const available = await availableCount(tx, draft.id)
  const step = advance(ctx, pickNo + 1, counts, available)

  const completed = await commitAdvance(
    tx,
    ctx,
    step,
    input.actorUserId,
    async (timing) => {
      await appendDraftEvent(tx, draft.id, "pick", input.actorUserId, {
        pickNo,
        round: roundOf(pickNo, slots.length),
        slotId: slot.id,
        poolEntryId: entry.id,
        userId: entry.userId,
        auto: input.auto,
        forced: input.reason === "forced",
        reason: input.reason,
        consecutiveTimeouts: timeouts,
        ...timerPayload(timing),
      })
    }
  )
  return { success: true, pickNo, completed }
}

export interface CommitSkipInput {
  pickNo: number
  slot: DraftTeamSlotRow
  /** The user who skipped the turn; null for the timer. */
  actorUserId: string | null
  reason: Exclude<DraftSkipReason, "team_full">
  /** The captain's timeouts in a row after this skip. */
  consecutiveTimeouts: number
}

/** The on-turn captain loses the pick (timer or manager); the turn moves on. */
export async function commitSkip(
  tx: Tx,
  ctx: TurnContext,
  input: CommitSkipInput
): Promise<Result<{ pickNo: number; completed: boolean }>> {
  const { draft } = ctx
  const { pickNo, slot } = input
  const timeouts = await setTimeouts(tx, slot, input.consecutiveTimeouts)
  const counts = await pickCounts(tx, draft.id)
  const available = await availableCount(tx, draft.id)
  const step = advance(ctx, pickNo + 1, counts, available)

  const completed = await commitAdvance(
    tx,
    ctx,
    step,
    input.actorUserId,
    async (timing) => {
      await appendDraftEvent(tx, draft.id, "skipped", input.actorUserId, {
        pickNo,
        slotId: slot.id,
        reason: input.reason,
        consecutiveTimeouts: timeouts,
        ...timerPayload(timing),
      })
    }
  )
  return { success: true, pickNo, completed }
}
