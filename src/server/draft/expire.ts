import "server-only"

import { randomInt } from "node:crypto"

import { and, asc, eq, isNotNull, isNull, or, sql } from "drizzle-orm"

import { chooseAutoPick } from "@/lib/draft/autopick"
import { logger } from "@/lib/logger"
import { participantsAmong } from "@/server/authz/team-membership"
import { db } from "@/server/db"
import {
  draftPoolEntries,
  draftQueueEntries,
  drafts,
  type DraftRow,
} from "@/server/db/schema"
import {
  appendDraftEvent,
  deadlineIn,
  lockDraft,
  timerPayload,
  updateDraft,
  type Tx,
} from "./internal"
import { commitPick, commitSkip, loadTurn, slotAt } from "./turn"

/**
 * Pick timer enforcement (team draft 3/4, #217).
 *
 * The deadline (`draft.turn_deadline`) is the database clock; nothing the
 * client sends can move it. An expired turn is resolved by `resolveExpired`
 * under the same `FOR UPDATE` row lock a pick takes, so an expiry and a pick
 * can never both win: whichever gets the lock first changes the draft, the
 * other then sees the new state (a late pick finds the turn gone, an expiry
 * finds a fresh deadline).
 *
 * It runs lazily on every pick, every state read and every stream connect
 * (`settleExpiredDraft`), on startup and once per second from the sweeper
 * (`sweepExpiredDrafts`, guarded by an advisory lock so several instances do
 * not step on each other). `api/cron/draft-sweep` is an optional backstop.
 *
 * What an expired turn does is the draft's `on_timeout`:
 * - `auto_pick`: the first still-available entry of the captain's queue, else
 *   the best-rated (or a random) available player; `auto = true`,
 *   `reason = timer_auto` (`timer_queue` when the queue decided);
 * - `skip`: the captain loses the pick;
 * - `pause`: the draft pauses until a manager resumes it.
 */

export interface ExpiryOutcome {
  /** An expired turn was resolved (the draft changed). */
  acted: boolean
  /** The draft as it is now. */
  draft: DraftRow
}

/** Resolves the locked draft's turn if its deadline has passed. */
export async function expireLocked(
  tx: Tx,
  draft: DraftRow
): Promise<ExpiryOutcome> {
  const seconds = draft.pickTimerSeconds
  if (draft.status !== "in_progress" || !seconds) {
    return { acted: false, draft }
  }

  if (!draft.turnDeadline) {
    // A draft that started before the timer existed (a deploy mid-draft), or
    // one whose deadline was lost: arm it so the turn is timed from now.
    const timing = await updateDraft(tx, draft, {
      turnDeadline: deadlineIn(seconds),
    })
    if (!timing) return { acted: false, draft }
    await appendDraftEvent(tx, draft.id, "timer", null, timerPayload(timing))
    return {
      acted: false,
      draft: {
        ...draft,
        turnDeadline: timing.deadline ? new Date(timing.deadline) : null,
      },
    }
  }

  const [due] = await tx
    .select({ due: sql<boolean>`${drafts.turnDeadline} <= clock_timestamp()` })
    .from(drafts)
    .where(eq(drafts.id, draft.id))
  if (!due?.due) return { acted: false, draft }

  const ctx = await loadTurn(tx, draft)
  const pickNo = draft.currentPickNo
  const slot = slotAt(ctx, pickNo)
  const streak = slot.consecutiveTimeouts + 1

  if (draft.onTimeout === "pause") {
    const timing = await updateDraft(tx, draft, {
      status: "paused",
      turnDeadline: null,
      // The turn starts over with the full time when a manager resumes.
      pausedRemainingMs: seconds * 1000,
    })
    if (!timing) return { acted: false, draft }
    await appendDraftEvent(tx, draft.id, "paused", null, {
      reason: "timer",
      ...timerPayload(timing),
    })
  } else {
    const choice =
      draft.onTimeout === "auto_pick"
        ? await chooseForTimeout(tx, draft, slot.id)
        : null
    if (choice) {
      await commitPick(tx, ctx, {
        pickNo,
        slot,
        entry: choice.entry,
        actorUserId: null,
        auto: true,
        reason: choice.source === "queue" ? "timer_queue" : "timer_auto",
        consecutiveTimeouts: streak,
      })
    } else {
      // `skip`, or an auto-pick with nobody left to take.
      await commitSkip(tx, ctx, {
        pickNo,
        slot,
        actorUserId: null,
        reason: "timer_skip",
        consecutiveTimeouts: streak,
      })
    }
  }

  const fresh = await lockDraft(tx, draft.id)
  return { acted: true, draft: fresh ?? draft }
}

async function chooseForTimeout(tx: Tx, draft: DraftRow, slotId: string) {
  const entries = await tx
    .select()
    .from(draftPoolEntries)
    .where(
      and(
        eq(draftPoolEntries.draftId, draft.id),
        eq(draftPoolEntries.status, "available")
      )
    )
    .orderBy(asc(draftPoolEntries.snapshotAt), asc(draftPoolEntries.id))
  // Somebody who left the Event, or whose account is gone, cannot be placed.
  const userIds = entries.flatMap((e) => (e.userId ? [e.userId] : []))
  const inEvent = await participantsAmong(tx, draft.eventId, userIds)
  const eligible = entries.filter((e) => e.userId && inEvent.has(e.userId))

  const queue = await tx
    .select({ poolEntryId: draftQueueEntries.poolEntryId })
    .from(draftQueueEntries)
    .where(eq(draftQueueEntries.slotId, slotId))
    .orderBy(asc(draftQueueEntries.position))

  const choice = chooseAutoPick({
    rule: draft.autoPickRule,
    candidates: eligible.map((e) => ({
      poolEntryId: e.id,
      rating: e.ratingSnapshot,
    })),
    queue: queue.map((q) => q.poolEntryId),
    randomInt: (bound) => randomInt(bound),
  })
  const entry = choice && eligible.find((e) => e.id === choice.poolEntryId)
  return choice && entry ? { entry, source: choice.source } : null
}

/** Locks the draft and resolves its turn if the deadline has passed. */
export async function resolveExpired(
  tx: Tx,
  draftId: string
): Promise<{ acted: boolean }> {
  const draft = await lockDraft(tx, draftId)
  if (!draft) return { acted: false }
  const { acted } = await expireLocked(tx, draft)
  return { acted }
}

/**
 * Lazy enforcement for readers (the draft page, the state endpoint, a stream
 * connect): resolves the Event's draft if its turn has expired. Never throws;
 * a timer problem must not break a read.
 */
export async function settleExpiredDraft(eventId: string): Promise<boolean> {
  try {
    const [due] = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(
          eq(drafts.eventId, eventId),
          eq(drafts.status, "in_progress"),
          isNotNull(drafts.pickTimerSeconds),
          or(
            isNull(drafts.turnDeadline),
            sql`${drafts.turnDeadline} <= clock_timestamp()`
          )
        )
      )
      .limit(1)
    if (!due) return false
    const result = await db.transaction((tx) => resolveExpired(tx, due.id))
    return result.acted
  } catch (error) {
    logger.error({ error, eventId }, "Could not resolve an expired draft turn")
    return false
  }
}

// ---------------------------------------------------------------------------
// Sweeper
// ---------------------------------------------------------------------------

/** Arbitrary constant: the advisory lock the sweepers compete for. */
export const SWEEPER_LOCK_KEY = 2_170_217_001

export interface SweepResult {
  /** False: another sweeper holds the lock, nothing was done. */
  locked: boolean
  /** Drafts whose expired turn was resolved. */
  resolved: number
}

/**
 * One sweep: takes `pg_try_advisory_xact_lock` (released when the transaction
 * ends, so it is safe behind a connection pool) and resolves every expired
 * turn. Each draft is resolved in its own savepoint, so one failing draft
 * does not hold up the others.
 */
export async function sweepExpiredDrafts(): Promise<SweepResult> {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ locked: boolean }>(
      sql`select pg_try_advisory_xact_lock(${SWEEPER_LOCK_KEY}::bigint) as locked`
    )
    if (!rows[0]?.locked) return { locked: false, resolved: 0 }

    const due = await tx
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(
          eq(drafts.status, "in_progress"),
          isNotNull(drafts.pickTimerSeconds),
          or(
            isNull(drafts.turnDeadline),
            sql`${drafts.turnDeadline} <= clock_timestamp()`
          )
        )
      )
    let resolved = 0
    for (const { id } of due) {
      try {
        const result = await tx.transaction((inner) =>
          resolveExpired(inner as Tx, id)
        )
        if (result.acted) resolved += 1
      } catch (error) {
        logger.error({ error, draftId: id }, "Could not resolve a draft turn")
      }
    }
    return { locked: true, resolved }
  })
}

interface SweeperState {
  timer: ReturnType<typeof setInterval>
  running: boolean
}

// On globalThis so a dev server's module reloads do not start a second timer.
const globalForSweeper = globalThis as unknown as {
  draftSweeper?: SweeperState
}

/**
 * Starts the once-per-second sweeper in this process, and sweeps right away
 * (a deploy in the middle of a draft left expired turns behind). Safe to call
 * more than once. Needs a long-lived Node process, like the stream hub.
 */
export function startDraftSweeper(intervalMs = 1000): void {
  if (globalForSweeper.draftSweeper) return
  const state: SweeperState = {
    running: false,
    timer: setInterval(() => void tick(), intervalMs),
  }
  state.timer.unref?.()
  globalForSweeper.draftSweeper = state

  async function tick() {
    if (state.running) return
    state.running = true
    try {
      await sweepExpiredDrafts()
    } catch (error) {
      logger.error({ error }, "Draft sweeper failed")
    } finally {
      state.running = false
    }
  }
  void tick()
}

export function stopDraftSweeper(): void {
  const state = globalForSweeper.draftSweeper
  if (!state) return
  clearInterval(state.timer)
  globalForSweeper.draftSweeper = undefined
}
