import "server-only"

import { and, asc, eq, sql, type SQL } from "drizzle-orm"

import { isPermutation } from "@/lib/draft/order"
import { DRAFT_NOTIFY_CHANNEL, type DraftNotifyPayload } from "@/lib/draft/sse"
import type {
  DraftEventPayloads,
  DraftEventType,
  DraftStatus,
  DraftTimerFields,
} from "@/lib/draft/types"
import {
  failure,
  type ActionFailure,
  type ActionResult,
} from "@/server/authz/guards"
import type { Tx } from "@/server/authz/team-membership"
import { draftEvents, drafts, type DraftRow } from "@/server/db/schema"

/**
 * The plumbing the draft lifecycle (`core.ts`) and the timer (`expire.ts`)
 * share: the row lock, the log, guarded updates and the timer SQL. Everything
 * here runs in the caller's transaction.
 */

export type { Tx }
export type Result<T extends object = object> = ActionResult<T>

export const NOT_FOUND = failure("Draft not found", "NOT_FOUND")

export const CONFLICT_CHANGED = failure(
  "The draft changed while you were acting. Reload and try again.",
  "CONFLICT"
)

class AbortWith extends Error {
  constructor(readonly failure: ActionFailure) {
    super(failure.error)
  }
}

/** Runs `fn` in a savepoint; a returned failure rolls the savepoint back. */
export async function atomic<T extends object>(
  tx: Tx,
  fn: (inner: Tx) => Promise<Result<T>>
): Promise<Result<T>> {
  try {
    return await tx.transaction(async (inner) => {
      const result = await fn(inner as Tx)
      if (!result.success) throw new AbortWith(result)
      return result
    })
  } catch (error) {
    if (error instanceof AbortWith) return error.failure
    throw error
  }
}

export async function lockDraft(
  tx: Tx,
  draftId: string
): Promise<DraftRow | null> {
  const [row] = await tx
    .select()
    .from(drafts)
    .where(eq(drafts.id, draftId))
    .for("update")
    .limit(1)
  return row ?? null
}

/** Appends a row to the draft log and returns its `seq`. */
export async function appendDraftEvent<T extends DraftEventType>(
  tx: Tx,
  draftId: string,
  type: T,
  actorUserId: string | null,
  payload: DraftEventPayloads[T]
): Promise<number> {
  const [row] = await tx
    .insert(draftEvents)
    .values({
      draftId,
      type,
      actorUserId,
      payload: payload as Record<string, unknown>,
    })
    .returning({ seq: draftEvents.seq })
  if (!row) throw new Error("draft_event insert returned no row")
  // Wake the live streams. Postgres delivers this only if the transaction
  // commits, and only `{ draftId, seq }` travels (the payload limit is 8 KB):
  // the streams read the log row themselves.
  const notice: DraftNotifyPayload = { draftId, seq: row.seq }
  await tx.execute(
    sql`select pg_notify(${DRAFT_NOTIFY_CHANNEL}, ${JSON.stringify(notice)})`
  )
  return row.seq
}

export type DraftUpdate = {
  [K in keyof typeof drafts.$inferInsert]?:
    | (typeof drafts.$inferInsert)[K]
    | SQL
}

/** The timer as the database has it right after an update. */
export interface DraftTiming {
  deadline: string | null
  /** ISO time of the database clock. */
  serverNow: string
  pausedRemainingMs: number | null
}

/** Database time as epoch milliseconds (never the app server's clock). */
const dbNowMs = sql<number>`(extract(epoch from clock_timestamp()) * 1000)::float8`

/** The timer fields of an event payload. */
export function timerPayload(timing: DraftTiming): DraftTimerFields {
  return {
    deadline: timing.deadline,
    serverNow: timing.serverNow,
    pausedRemainingMs: timing.pausedRemainingMs,
  }
}

/** `now() + seconds` on the database clock, for `turn_deadline`. */
export function deadlineIn(seconds: number): SQL {
  return sql`clock_timestamp() + ${seconds}::double precision * interval '1 second'`
}

/** `now() + milliseconds` on the database clock (resume). */
export function deadlineInMs(milliseconds: number): SQL {
  return sql`clock_timestamp() + ${milliseconds}::double precision * interval '1 millisecond'`
}

/** Milliseconds left until `turn_deadline`, never negative (pause). */
export const remainingMsSql = sql`greatest(0, floor(extract(epoch from (${drafts.turnDeadline} - clock_timestamp())) * 1000))::int`

/**
 * Updates the locked draft, bumps `version` and `updated_at`, and only when it
 * still has the status it was read with. Null: nothing was updated. Otherwise
 * the timer as the database now has it, for the log event that follows.
 */
export async function updateDraft(
  tx: Tx,
  draft: Pick<DraftRow, "id" | "status">,
  set: DraftUpdate
): Promise<DraftTiming | null> {
  const rows = await tx
    .update(drafts)
    .set({
      ...set,
      version: sql`${drafts.version} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(drafts.id, draft.id), eq(drafts.status, draft.status)))
    .returning({
      deadline: drafts.turnDeadline,
      pausedRemainingMs: drafts.pausedRemainingMs,
      nowMs: dbNowMs,
    })
  const [row] = rows
  if (!row) return null
  return {
    deadline: row.deadline ? row.deadline.toISOString() : null,
    serverNow: new Date(Number(row.nowMs)).toISOString(),
    pausedRemainingMs: row.pausedRemainingMs,
  }
}

export function statusMessage(status: DraftStatus): string {
  switch (status) {
    case "setup":
      return "The draft has not started yet"
    case "open":
      return "The draft has not started yet"
    case "paused":
      return "The draft is paused"
    case "complete":
      return "The draft is complete"
    case "cancelled":
      return "The draft was cancelled"
    default:
      return "The draft is not running"
  }
}

export async function loadPermutation(
  tx: Tx,
  draftId: string,
  slotCount: number
): Promise<number[]> {
  const [started] = await tx
    .select({ payload: draftEvents.payload })
    .from(draftEvents)
    .where(
      and(eq(draftEvents.draftId, draftId), eq(draftEvents.type, "started"))
    )
    .orderBy(asc(draftEvents.seq))
    .limit(1)
  const permutation = (
    started?.payload as { permutation?: unknown } | undefined
  )?.permutation
  if (!isPermutation(permutation, slotCount)) {
    throw new Error("The draft has no valid start event")
  }
  return permutation as number[]
}
