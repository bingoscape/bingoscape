import type { db } from "@/server/db"
import {
  eventAuditLog,
  type EventAuditLogInsert,
  type EventAuditLogRow,
} from "@/server/db/schema"

/**
 * How long `event_audit_log` (and `role_change_log`) rows are meant to be kept.
 * Default pending the maintainer's answer on decision 10 of epic #183. No
 * purge job exists yet: rows are only deleted by hand until one is added.
 *
 * Both tables store user ids without foreign keys, so a user-erasure request
 * is served by setting `actor_user_id` / `subject_user_id` to NULL on that
 * user's rows (the rows stay, anonymised).
 */
export const EVENT_AUDIT_RETENTION_DAYS = 365

/** Anything that can insert: the `db` or a transaction handle. */
type Inserter = Pick<typeof db, "insert">

/**
 * Appends one row to `event_audit_log`. Pass the transaction handle to make the
 * entry part of the change it records; pass `db` to record a denial or failure
 * outside any transaction. The wiring into the guards and changeRole() is
 * done in later phases.
 */
export async function recordEventAudit(
  executor: Inserter,
  entry: EventAuditLogInsert
): Promise<EventAuditLogRow> {
  const [row] = await executor.insert(eventAuditLog).values(entry).returning()
  if (!row) throw new Error("event_audit_log insert returned no row")
  return row
}
