import { isUuid, type RawSearchParams } from "@/lib/admin-list-params"
import { maskEmail } from "@/lib/super-admin-email"
import { userLabel } from "@/lib/super-admin-format"

/**
 * Pure helpers that shape what goes into `admin_audit_log`. Snapshots are
 * built field by field from an allowlist: password hashes, usernames, tokens
 * and images never appear, and emails are always masked (`j***@domain`).
 */

export type AuditTargetType = "user" | "clan" | "event" | "image"
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
  return prefix === "user" ||
    prefix === "clan" ||
    prefix === "event" ||
    prefix === "image"
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
  // A wiki image cache key (`image.*` actions); keys are up to 512 characters.
  if (typeof record.key === "string") return record.key.slice(0, 512)
  return null
}

export interface AuditFilters {
  action: string | null
  actorId: string | null
  targetType: AuditTargetType | null
  targetId: string | null
}

const ACTION_RE = /^[a-z]{1,20}(\.[a-z]{1,20}){1,2}$/
const TARGET_ID_RE = /^[0-9a-zA-Z-]{1,64}$/

function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim()
}

/** Reads `?action=&actor=&targetType=&targetId=`; anything malformed is ignored. */
export function parseAuditFilters(raw: RawSearchParams): AuditFilters {
  const action = firstParam(raw.action)
  const actor = firstParam(raw.actor)
  const targetType = firstParam(raw.targetType)
  const targetId = firstParam(raw.targetId)
  return {
    action: action && ACTION_RE.test(action) ? action : null,
    actorId: actor && isUuid(actor) ? actor : null,
    targetType:
      targetType === "user" || targetType === "clan" || targetType === "event"
        ? targetType
        : null,
    targetId: targetId && TARGET_ID_RE.test(targetId) ? targetId : null,
  }
}
