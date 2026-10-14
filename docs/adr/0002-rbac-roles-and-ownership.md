# 0002: Roles, ownership and the audit trail (RBAC epic #183)

Status: **accepted for the parts that are code; the parts marked "assumed" are
defaults pending maintainer confirmation.** This record is the end state of the
eight phases of epic #183 (#184 to #191). It supersedes nothing;
`0001-read-visibility-defaults.md` covers decisions 3 to 5 in detail.

## Context

Access was decided by about 40 hand-written "admin or management" checks and
about 170 role strings, three code paths disagreed about the Event creator,
return shapes differed per action, and a role change overwrote the previous value
without a trace. The epic replaced this with one policy, an explicit owner, a
ledger and database-enforced membership invariants, in add-first steps that each
deployed on their own.

## The model

### Roles stay in the database

`event_role` (`admin` > `management` > `participant`) and `clan_role` (`admin` >
`management` > `member` > `guest`) are Postgres enums, as before. Roles are not
runtime-editable and there are no custom per-Event roles (a non-goal of the epic;
revisit only if it becomes a requirement). A Player's Event role is their one
`event_participants` row, unique per `(event_id, user_id)`. Team membership
(`team_members`, unique per `(event_id, user_id)` and `(team_id, user_id)`, with
`event_id` NOT NULL and tied to the Team's Event by a composite foreign key) is a
relation, not a role: it grants only the Team scoped permissions.

### Permissions are code

`src/lib/authz/permissions.ts` maps each Event role to `<subject>:<action>`
permissions; `src/lib/authz/policy.ts` evaluates `can(actor, permission,
resource)` as a pure function. Relational rules sit on top of the grant: nobody
adds, grants or acts on a role above their own; Team members and leaders get the
Team scoped permissions for their own Team. `management` manages everything
except roles, Event settings, invites, rules and the owner-only actions;
`management` may edit buy-ins and donations (`finance:write`). Server actions,
route handlers and server pages ask `authorize`, `requirePermission` or
`hasPermission` (`@/server/authz`); the registry (`registry.ts`) lists every
public entry point with its permission or the reason it is public, and a test
fails when one is missing. ESLint (`no-restricted-syntax`) forbids comparing a
role string outside `src/lib/authz` and `src/server/authz`.

### Owner

`events.creator_id` and `clans.owner_id` are the owner pointers; no new enum
value. The owner always also has an `admin` row (created with the Event, backfilled
by migrations 0038 and 0041). The role of an actor is exactly their row: since
RBAC 8/8 the creator is no longer counted as admin without one, and the
`creator_without_participant_row` / `creator_role_conflicts` verification checks
report any fault. Owner-only: delete the Event, grant the admin role (to a new or
existing participant) and transfer ownership. All other admin permissions belong
to every admin. If the creator account is gone (`creator_id` is null), the oldest
admin acts as owner. The owner can be neither demoted nor removed; ownership
moves by explicit transfer, after which the previous owner remains an admin.

### Last admin

An Event and a Clan always keep one admin. A demotion or removal that would leave
none is refused, also for two concurrent demotions: the membership helper locks
the Event or Clan row (`SELECT ... FOR UPDATE`) before it checks.

### One writer, one ledger

`changeRole()`, `addMember()`, `removeMember()` and `transferOwnership()`
(`src/server/authz/membership.ts`) are the only code that writes
`event_participants` and `clan_members`. Each runs in one transaction under the
parent lock, checks the invariants, writes the row and appends one row to
`role_change_log` (who, whom, old and new role, source, reason, request id).
Replaying the ledger must give the live roles. A safety-net trigger records any
write that bypasses the helper (source `trigger`), and a daily reconciliation
(`GET /api/cron/rbac-reconcile`, the queries in `verification.ts`) fails loudly
on drift, duplicates, Events without admin and the other invariants.
`event_audit_log` records permission-relevant Event actions. Both tables hold
user ids without foreign keys, so an erasure request is served by nulling the
user columns.

### Read policy

`src/lib/authz/read-policy.ts` turns the viewer's standing (`manager`, `member`,
`public`, `summary`, `none`) into what each read returns; draft Boards, hidden
and Blind Tiles, battleship privacy and the tracker verification code are
managers only. Defaults and the escape hatch (`RBAC_READ_POLICY=relaxed`) are in
`0001-read-visibility-defaults.md`.

### Capabilities

`EventCapabilities` (`src/lib/authz/capabilities.ts`) are booleans computed on the
server once per request and passed to client components as props. A component
never compares a role string; capabilities only decide what is shown, the guard
on every action stays the authority. Role badges use lookups (`roleBadgeVariant`),
not comparisons.

### Credentials and sessions

API keys are stored as SHA-256 hashes with an 8 character display prefix, with
scopes, expiry and revocation; the legacy plaintext column and its dual-read are
gone (migration 0041). Sessions are a pointer to the user row, checked per
request, with "sign out everywhere". Super-admin allowlist entries count only for
an email the OAuth provider verified.

### Return convention

Actions return `{ success: true, ... }` or `{ success: false, error, code? }`
(`UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID`, `CONFLICT`, `FAILED`,
`RATE_LIMITED`); reads answer the empty value instead of throwing.

## Open decisions of #183 and the defaults that were assumed

| # | Question | Assumed (current behaviour) |
| - | -------- | --------------------------- |
| 1 | Owner and a deleted creator | `creator_id` stays the pointer plus an admin row; owner-only actions are delete, grant admin, transfer; with no creator the oldest admin owns the Event; at least one admin always remains. **Implemented.** |
| 2 | Super admin inside an Event | Env-only allowlist (`SUPER_ADMIN_EMAILS`), reached through `/super-admin`; entries need a provider-verified email. A table with expiry was **not** built. |
| 3 | Non-public Events | Link holders get the join card only (`link-holders`). Pending confirmation, ADR 0001. |
| 4 | Uploads | Public, long-lived URL (`public-url`). Pending confirmation, ADR 0001. |
| 5 | Codephrase | Visible to participants (`players`). Pending confirmation, ADR 0001. |
| 6 | Management permissions | `management` edits buy-ins and donations but not roles. Kept. |
| 7 | Submission comments | Managers write; managers and the owning Team read. Kept. |
| 8 | Two Teams per Player per Event | No: unique `(event_id, user_id)` on `team_members`. Assumed from `CONTEXT.md` and the app, which already moved Players instead of adding them. |
| 9 | Deployment shape | One instance; rate-limit counters are in memory behind a `RateLimitStore` interface. |
| 10 | Audit retention | 365 days (`EVENT_AUDIT_RETENTION_DAYS`), no purge job yet. Pending. |

## Consequences

- A creator row without `admin` is now a data fault (no implicit admin). Migration
  0041 repairs existing ones; the reconciliation reports new ones.
- `discord_webhooks.created_by` is `NOT NULL ... ON DELETE CASCADE`: consistent,
  but deleting the user who created a webhook removes the Event's webhook.
  Left as is; making it nullable with `SET NULL` is the alternative if webhooks
  should outlive their creator.
- `clan_invites.created_by` was `NOT NULL ... ON DELETE SET NULL`, which made
  deleting the creator of an invite fail. It is now nullable: an invite belongs
  to the Clan and outlives whoever created it (the UI already shows "Unknown").
- Contract migrations ship one release after their replacement and cannot be
  rolled back in the database; see `docs/DATABASE-MIGRATION.md`.
