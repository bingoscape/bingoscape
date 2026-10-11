import { maskEmail } from "@/lib/super-admin-email"
import { userLabel } from "@/lib/super-admin-format"

/**
 * Pure helpers that shape what goes into `admin_audit_log`. Snapshots are
 * built field by field from an allowlist: password hashes, usernames, tokens
 * and images never appear, and emails are always masked (`j***@domain`).
 */

export type AuditTargetType = "user" | "clan" | "event"
export type AuditOutcome = "success" | "denied" | "failed"

export interface AuditDraft {
  /** e.g. `user.update` */
  action: string
  targetType: AuditTargetType
  targetId: string
  targetLabel?: string | null
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  reason?: string | null
}

export function userAuditSnapshot(row: {
  name?: string | null
  email?: string | null
  runescapeName?: string | null
}): Record<string, unknown> {
  return {
    name: row.name ?? null,
    email: maskEmail(row.email),
    runescapeName: row.runescapeName ?? null,
  }
}

export function userAuditLabel(row: {
  id: string
  name: string | null
  runescapeName: string | null
}): string {
  return userLabel(row)
}

export function clanAuditSnapshot(row: {
  name?: string
  description?: string | null
  ownerId?: string | null
}): Record<string, unknown> {
  return {
    name: row.name,
    description: row.description ?? null,
    ownerId: row.ownerId ?? null,
  }
}

export function eventAuditSnapshot(row: {
  title?: string
  description?: string | null
  startDate?: Date
  endDate?: Date
  locked?: boolean
  public?: boolean
  clanId?: string | null
}): Record<string, unknown> {
  return {
    title: row.title,
    description: row.description ?? null,
    startDate: row.startDate?.toISOString(),
    endDate: row.endDate?.toISOString(),
    locked: row.locked,
    public: row.public,
    clanId: row.clanId ?? null,
  }
}

/** Keeps only `keys` from a snapshot, dropping undefined values. */
export function pickKeys(
  snapshot: Record<string, unknown>,
  keys: readonly string[]
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const key of keys) {
    if (snapshot[key] !== undefined) out[key] = snapshot[key]
  }
  return out
}

/** Target type for an action name such as `clan.member.role` -> `clan`. */
export function targetTypeFromAction(action: string): AuditTargetType | null {
  const prefix = action.split(".")[0]
  return prefix === "user" || prefix === "clan" || prefix === "event"
    ? prefix
    : null
}

/** First id-like string found in a raw (unvalidated) input, capped in length. */
export function targetIdFromInput(input: unknown): string | null {
  if (typeof input !== "object" || input === null) return null
  const record = input as Record<string, unknown>
  for (const key of ["userId", "clanId", "eventId"]) {
    const value = record[key]
    if (typeof value === "string") return value.slice(0, 64)
  }
  return null
}
