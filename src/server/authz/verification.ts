/**
 * Membership invariants of the RBAC model (epic #183) as read-only SQL.
 *
 * Every check returns the offending rows, so an empty result means the
 * invariant holds. Used in three places:
 *   - on a restored production backup, before and after migration 0038
 *     (`npm run db:verify-rbac`, exits non-zero when an `error` check fails);
 *   - by the migration tests;
 *   - as the reconciliation job of the role ledger (RBAC 3/8).
 *
 * `severity: "warn"` marks findings that are expected to exist for a while and
 * have a documented resolution (see docs/DATABASE-MIGRATION.md): rows written
 * by the previous app version, or duplicate users that block a unique index.
 *
 * Pure SQL strings, no database import: the script bundles this file without
 * the app's env validation.
 */

const T = {
  users: '"bingoscape-next_user"',
  events: '"bingoscape-next_events"',
  participants: '"bingoscape-next_event_participants"',
  teams: '"bingoscape-next_teams"',
  teamMembers: '"bingoscape-next_team_members"',
  clans: '"bingoscape-next_clans"',
  clanMembers: '"bingoscape-next_clan_members"',
  ledger: '"bingoscape-next_role_change_log"',
} as const

export type VerificationSeverity = "error" | "warn"

export interface VerificationCheck {
  id: string
  description: string
  severity: VerificationSeverity
  /** Returns the violating rows; at most 200. */
  sql: string
}

export const RBAC_VERIFICATION_CHECKS: readonly VerificationCheck[] = [
  {
    id: "duplicate_participants",
    description: "Users with more than one participant row in an Event",
    severity: "error",
    sql: `SELECT event_id, user_id, count(*)::int AS row_count
FROM ${T.participants}
GROUP BY event_id, user_id
HAVING count(*) > 1
LIMIT 200`,
  },
  {
    id: "duplicate_team_members_in_team",
    description: "Users with more than one membership row in the same Team",
    severity: "error",
    sql: `SELECT team_id, user_id, count(*)::int AS row_count
FROM ${T.teamMembers}
GROUP BY team_id, user_id
HAVING count(*) > 1
LIMIT 200`,
  },
  {
    id: "duplicate_team_members_in_event",
    description: "Users on more than one Team of the same Event",
    severity: "error",
    sql: `SELECT t.event_id, tm.user_id, count(*)::int AS row_count
FROM ${T.teamMembers} tm
JOIN ${T.teams} t ON t.id = tm.team_id
GROUP BY t.event_id, tm.user_id
HAVING count(*) > 1
LIMIT 200`,
  },
  {
    id: "events_without_admin",
    description: "Events that have no admin participant row",
    severity: "error",
    sql: `SELECT e.id AS event_id, e.creator_id
FROM ${T.events} e
WHERE NOT EXISTS (
  SELECT 1 FROM ${T.participants} ep WHERE ep.event_id = e.id AND ep.role = 'admin'
)
LIMIT 200`,
  },
  {
    id: "clans_without_admin",
    description: "Clans that have no admin member",
    severity: "error",
    sql: `SELECT c.id AS clan_id, c.owner_id
FROM ${T.clans} c
WHERE NOT EXISTS (
  SELECT 1 FROM ${T.clanMembers} cm WHERE cm.clan_id = c.id AND cm.role = 'admin'
)
LIMIT 200`,
  },
  {
    id: "clan_owner_not_admin",
    description: "Clans whose owner is not an admin member of the Clan",
    severity: "error",
    sql: `SELECT c.id AS clan_id, c.owner_id, cm.role AS owner_role
FROM ${T.clans} c
LEFT JOIN ${T.clanMembers} cm ON cm.clan_id = c.id AND cm.user_id = c.owner_id
WHERE c.owner_id IS NOT NULL AND cm.role IS DISTINCT FROM 'admin'
LIMIT 200`,
  },
  {
    id: "team_members_not_participants",
    description: "Team members who are not participants of the Team's Event",
    severity: "error",
    sql: `SELECT tm.id AS team_member_id, tm.team_id, t.event_id, tm.user_id
FROM ${T.teamMembers} tm
JOIN ${T.teams} t ON t.id = tm.team_id
WHERE NOT EXISTS (
  SELECT 1 FROM ${T.participants} ep WHERE ep.event_id = t.event_id AND ep.user_id = tm.user_id
)
LIMIT 200`,
  },
  {
    id: "creator_without_participant_row",
    description: "Event creators without a participant row",
    severity: "error",
    sql: `SELECT e.id AS event_id, e.creator_id
FROM ${T.events} e
WHERE e.creator_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM ${T.participants} ep WHERE ep.event_id = e.id AND ep.user_id = e.creator_id
  )
LIMIT 200`,
  },
  {
    id: "creator_role_conflicts",
    description:
      "Event creators whose explicit participant role is not admin (the policy treats the creator as admin)",
    severity: "error",
    sql: `SELECT e.id AS event_id, e.creator_id, ep.role AS explicit_role
FROM ${T.events} e
JOIN ${T.participants} ep ON ep.event_id = e.id AND ep.user_id = e.creator_id
WHERE ep.role <> 'admin'
LIMIT 200`,
  },
  {
    id: "team_members_event_id_mismatch",
    description: "team_members.event_id differs from the Team's Event",
    severity: "error",
    sql: `SELECT tm.id AS team_member_id, tm.team_id, tm.event_id, t.event_id AS team_event_id
FROM ${T.teamMembers} tm
JOIN ${T.teams} t ON t.id = tm.team_id
WHERE tm.event_id IS NOT NULL AND tm.event_id <> t.event_id
LIMIT 200`,
  },
  {
    id: "team_members_missing_event_id",
    description:
      "team_members rows without event_id (written by the previous app version; backfill again before RBAC 8/8)",
    severity: "warn",
    sql: `SELECT id AS team_member_id, team_id, user_id
FROM ${T.teamMembers}
WHERE event_id IS NULL
LIMIT 200`,
  },
  {
    id: "ledger_drift",
    description:
      "Live memberships whose latest role_change_log entry disagrees (or is missing), and ledger memberships that no longer exist",
    severity: "error",
    sql: `WITH latest AS (
  SELECT DISTINCT ON (scope_type, scope_id, subject_user_id)
         scope_type, scope_id, subject_user_id, new_role
  FROM ${T.ledger}
  WHERE subject_user_id IS NOT NULL
  ORDER BY scope_type, scope_id, subject_user_id, seq DESC
), live AS (
  SELECT 'event'::text AS scope_type, event_id AS scope_id, user_id AS subject_user_id, role::text AS role
  FROM ${T.participants}
  UNION ALL
  SELECT 'clan'::text, clan_id, user_id, role::text
  FROM ${T.clanMembers}
)
SELECT scope_type, scope_id, subject_user_id, live.role AS live_role, latest.new_role AS ledger_role
FROM live
FULL OUTER JOIN latest USING (scope_type, scope_id, subject_user_id)
WHERE live.role IS DISTINCT FROM latest.new_role
  AND (
    live.role IS NOT NULL
    OR (
      -- A ledger-only entry is drift only while its Event/Clan and user exist
      -- (deleting either removes the membership without a ledger row).
      EXISTS (SELECT 1 FROM ${T.users} u WHERE u.id = subject_user_id)
      AND (
        (scope_type = 'event' AND EXISTS (SELECT 1 FROM ${T.events} e WHERE e.id = scope_id))
        OR (scope_type = 'clan' AND EXISTS (SELECT 1 FROM ${T.clans} c WHERE c.id = scope_id))
      )
    )
  )
LIMIT 200`,
  },
  {
    id: "duplicate_usernames",
    description:
      "Usernames used by several users (blocks users_username_unique; resolve by hand)",
    severity: "warn",
    sql: `SELECT username, count(*)::int AS row_count
FROM ${T.users}
WHERE username IS NOT NULL
GROUP BY username
HAVING count(*) > 1
LIMIT 200`,
  },
  {
    id: "duplicate_emails",
    description:
      "Emails used by several users, compared exactly (blocks users_email_unique; resolve by hand)",
    severity: "warn",
    sql: `SELECT email, count(*)::int AS row_count
FROM ${T.users}
WHERE email IS NOT NULL
GROUP BY email
HAVING count(*) > 1
LIMIT 200`,
  },
  {
    id: "duplicate_emails_ignoring_case",
    description:
      "Emails that differ only in letter case (not blocked by the index; review)",
    severity: "warn",
    sql: `SELECT lower(email) AS email, count(*)::int AS row_count
FROM ${T.users}
WHERE email IS NOT NULL
GROUP BY lower(email)
HAVING count(*) > 1 AND count(DISTINCT email) > 1
LIMIT 200`,
  },
  {
    id: "missing_membership_indexes",
    description: "Expected membership unique indexes that do not exist",
    severity: "error",
    sql: `SELECT expected.name AS index_name
FROM (VALUES
  ('event_participants_event_user_unique'),
  ('team_members_team_user_unique'),
  ('team_members_event_user_unique'),
  ('teams_id_event_id_unique')
) AS expected(name)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes i
  WHERE i.indexname = expected.name AND i.schemaname = current_schema()
)`,
  },
  {
    id: "missing_user_unique_indexes",
    description:
      "users_username_unique / users_email_unique missing (skipped by the migration because of duplicates)",
    severity: "warn",
    sql: `SELECT expected.name AS index_name
FROM (VALUES ('users_username_unique'), ('users_email_unique')) AS expected(name)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_indexes i
  WHERE i.indexname = expected.name AND i.schemaname = current_schema()
)`,
  },
]

/** Runs one SQL string and returns its rows (adapter for any driver). */
export type VerificationExecutor = (
  query: string
) => Promise<Record<string, unknown>[]>

export interface VerificationResult {
  id: string
  description: string
  severity: VerificationSeverity
  rows: Record<string, unknown>[]
  /** Set when the query itself failed (e.g. a table of 0038 does not exist yet). */
  error?: string
}

/**
 * Runs every check; results keep the order of RBAC_VERIFICATION_CHECKS. A
 * query that throws is reported on its result instead of aborting the run, and
 * counts as a violation.
 */
export async function runRbacVerification(
  execute: VerificationExecutor,
  checks: readonly VerificationCheck[] = RBAC_VERIFICATION_CHECKS
): Promise<VerificationResult[]> {
  const results: VerificationResult[] = []
  for (const check of checks) {
    const base = {
      id: check.id,
      description: check.description,
      severity: check.severity,
    }
    try {
      results.push({ ...base, rows: await execute(check.sql) })
    } catch (error) {
      results.push({
        ...base,
        rows: [],
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }
  return results
}

/** The results that found something or failed, optionally only at one severity. */
export function violations(
  results: readonly VerificationResult[],
  severity?: VerificationSeverity
): VerificationResult[] {
  return results.filter(
    (r) =>
      r.rows.length > 0 && (severity === undefined || r.severity === severity)
  )
}
