import "server-only"

import { and, eq, inArray, isNotNull, lt, ne, or } from "drizzle-orm"

import { logger } from "@/lib/logger"
import { EVENT_AUDIT_RETENTION_DAYS } from "@/server/authz/audit-log"
import { db } from "@/server/db"
import { draftEvents, drafts } from "@/server/db/schema"

/**
 * Retention and erasure of the draft log (team draft 4/4, #218).
 *
 * `draft_event` follows `EVENT_AUDIT_RETENTION_DAYS`, like `event_audit_log`.
 * Only the log of a draft that is over (cancelled, or applied) and was last
 * touched before the cutoff is purged: a running or merely complete draft
 * still needs its log (the `started` event carries the pick order, and a
 * client catching up replays from it). Even then the `started` event stays,
 * because it is what `loadPermutation` reads to draw the room of a finished
 * draft; the rosters themselves live in `draft_pick` and are not touched.
 *
 * `draft_event.actor_user_id` has no foreign key, so erasing a user means
 * setting it to NULL (`anonymiseDraftActor`), which keeps the log intact.
 */

/** How often the sweeper looks for logs to purge. */
export const DRAFT_RETENTION_INTERVAL_MS = 6 * 60 * 60 * 1000

/**
 * Deletes the log events of finished drafts older than the retention window,
 * except each draft's `started` event. Returns the number of rows deleted.
 */
export async function purgeExpiredDraftLogs(
  now: Date = new Date(),
  retentionDays: number = EVENT_AUDIT_RETENTION_DAYS
): Promise<number> {
  const cutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000)
  const finished = db
    .select({ id: drafts.id })
    .from(drafts)
    .where(
      and(
        lt(drafts.updatedAt, cutoff),
        or(eq(drafts.status, "cancelled"), isNotNull(drafts.appliedAt))
      )
    )
  const deleted = await db
    .delete(draftEvents)
    .where(
      and(
        inArray(draftEvents.draftId, finished),
        ne(draftEvents.type, "started")
      )
    )
    .returning({ id: draftEvents.id })
  return deleted.length
}

/**
 * Erasure of a user: anonymises the draft log rows they acted in. (Their
 * picks, captaincies and pool entries reference the user with `ON DELETE SET
 * NULL`, which the account deletion itself takes care of.) Returns the number
 * of rows changed.
 */
export async function anonymiseDraftActor(userId: string): Promise<number> {
  const changed = await db
    .update(draftEvents)
    .set({ actorUserId: null })
    .where(eq(draftEvents.actorUserId, userId))
    .returning({ id: draftEvents.id })
  return changed.length
}

/** Runs `purgeExpiredDraftLogs` and never throws (a sweeper tick calls it). */
export async function purgeExpiredDraftLogsSafely(): Promise<void> {
  try {
    const deleted = await purgeExpiredDraftLogs()
    if (deleted > 0) logger.info({ deleted }, "Purged expired draft log events")
  } catch (error) {
    logger.error({ error }, "Could not purge expired draft log events")
  }
}
