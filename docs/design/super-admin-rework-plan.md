# Super-admin rework plan

Combined output of a UX/usability audit and a security audit of `src/app/super-admin/**`,
`src/components/super-admin-*.tsx` and `src/app/actions/super-admin.ts`.
Both audits were code reads only. Nothing was run, so contrast and responsive findings
are unverified until the QA phase.

## Summary

- Every exported action in `super-admin.ts` calls `requireSuperAdmin()` first, so ordinary users cannot call them.
- The risks are elsewhere:
  - How "super admin" is defined (an env email list matched against an unrevalidated JWT).
  - Password hashes serialized to the browser.
  - Unvalidated mass-assignment on updates.
  - Destructive deletes with no transaction, no guard, no audit trail.
- The UX problems are mostly structural: three copy-pasted tables, a single-click delete with unclear consequences, broken links and dead routes, misleading stats, and several WCAG failures.
- Several UX defects and security defects are the same defect seen from two sides. These are tracked once below.

## Findings that need fixing before any redesign (Phase 0)

| Ref     | Where                                                                                          | Problem                                                                                                                                                                                                               |
| ------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S3      | `super-admin.ts:241,274,290-305,338-358`; `users/[userId]/page.tsx`, `clans/[clanId]/page.tsx` | Full user rows, including the bcrypt `password`, are passed to client components and end up in the RSC payload.                                                                                                       |
| S1      | `src/lib/super-admin.ts:5-19`; `docker-compose.yml:60`                                         | Admin = case-sensitive, untrimmed email match against an env list. `users.email` has no unique index, OAuth emails are not verified, and compose falls back to `admin@example.com`.                                   |
| S6      | `super-admin.ts:369-383`                                                                       | Admin can edit any user's email. Combined with S1 this is a privilege-escalation and silent-impersonation path.                                                                                                       |
| S5      | `super-admin.ts:369-383,407-421,468-482`                                                       | `data` goes straight into `.set(data)`. A crafted POST can overwrite `password`, `id`, `creatorId`, etc. No validation, and `new Date("x")` becomes Invalid Date.                                                     |
| X1 / S4 | `super-admin-user-delete-modal.tsx:91-92` vs `super-admin.ts:385-404`                          | The modal says created events are kept. The action deletes them (`events.creator_id` is already `ON DELETE SET NULL`), cascading to other people's boards, tiles and submissions. No self-delete or last-admin guard. |
| X2      | `super-admin-clan-edit-modal.tsx:55,77,146`                                                    | "No owner" is stored as the sentinel `"defaultOwnerId"` and sent as a foreign key.                                                                                                                                    |
| X3      | users/clans/events pages and tables                                                            | Four links point to `/super-admin/events/[id]`, which does not exist (404).                                                                                                                                           |
| X4      | `super-admin-event-edit-modal.tsx:48-49`                                                       | `toISOString().slice(0,16)` is UTC but `datetime-local` is local time, so each save shifts the dates by the user's offset. No `end > start` check.                                                                    |
| X5      | `clans/page.tsx:79,94`; `users/page.tsx:81,98`; `events/page.tsx:22-31`                        | Stat cards are computed from the current 50-row page but labeled as totals. "Open Clans" and "Private Clans" show the same number.                                                                                    |
| X6      | `super-admin-member-role-modal.tsx:109`                                                        | The toast shows the literal text `&apos;`.                                                                                                                                                                            |

Effort: S for all of the above except S4/X1 (M, needs a product decision on what deleting a user should do with their events).

## Target information architecture

- **Shell:**
  - Left rail on desktop, top nav on mobile.
  - `aria-label`, `aria-current="page"` and active styling on nav items.
  - Breadcrumbs on every page.
  - The layout header is a landmark, not a second `h1`.
  - Non-admins get `notFound()` rather than a silent redirect.
- **Overview:**
  - Real aggregate counts, with each stat linking to a filtered list.
  - "Needs attention" lists: clans with no owner or admin, users with no email, events ending soon.
  - A recent admin actions feed from the audit log.
- **List pages:**
  - One shared `AdminDataTable` for users, clans and events.
  - URL state: `?q=&page=&pageSize=&sort=&dir=&status=`.
  - A labeled search with clear button; `aria-sort` on sortable headers; a `<caption>`.
  - The name cell is the row link; a single overflow menu per row for Edit and Delete.
  - `<nav aria-label>` pagination using links and `useTransition`.
  - `loading.tsx` skeleton, `error.tsx` with retry, and an empty state with "Clear filters".
  - Compact header (title, count, primary action) instead of the hero panels.
- **Detail pages:**
  - Users, clans and events each get a header (with copy-ID and a danger-zone menu) and tabs.
  - Cross-links go in both directions.
  - Build `events/[eventId]` (Participants, Teams and Boards, Settings), wiring up the existing `getEventDetails`, `removeEventParticipant` and `updateEventParticipantRole` actions that currently have no UI.
- **New screens required by the security design:**
  - Admins management.
  - Audit log with filters and per-entity History tab.
  - Trash / restore for soft-deleted entities.

## Security architecture the UI must accommodate

- **Identity:**
  - Admin comes from `users.role` or a `platform_admins` table.
  - The env list only bootstraps the first admin.
  - Unique index on `lower(email)`; reject unverified OAuth emails.
  - `sessionVersion` in the JWT, bumped on role change, email change, delete or "sign out everywhere".
  - Shorter `maxAge`.
- **Central guard** (`src/server/admin/guard.ts`):
  - `adminAction(schema, handler)` runs, in order: DB-backed admin check, Zod `.strict()` parse, rate limit, handler inside `db.transaction`.
  - It returns `{success, error}` and never throws. Every page and loader uses the same guard.
  - A test asserts that every export of `actions/super-admin*` goes through `adminAction`.
- **Audit log** `admin_audit_log`:
  - Columns: `id`, `created_at`, `actor_id`, `actor_label`, `action`, `target_type`, `target_id`, `target_label`, redacted `before`/`after` jsonb, `reason`, `request_id`, `ip`, `user_agent`, `outcome`.
  - Written in the same transaction as the mutation; denied attempts are logged too.
  - Never store password hashes or tokens.
- **Destructive operations:**
  - Soft delete by default.
  - Server-side impact preview, and the confirm token is bound to the target and the counts.
  - Typed entity name plus a required reason.
  - Invariants enforced in the transaction: no self-delete or self-demote, never remove the last super admin, never leave a clan without an owner or an event without an admin (ownership transfer instead).
  - Step-up re-auth for delete, email change and admin grant.
- **Data exposure:**
  - Per-entity select helpers that omit `password` and `username`.
  - A test fails if `password` appears in any action result.
  - Emails masked by default with an audited reveal.

## UX consequences of the security design

- Delete dialogs become two steps: impact preview, then typed name and reason.
- Every mutation form gets a reason field where the action is destructive or sensitive.
- Owner and last-admin changes use an ownership-transfer picker with a warning, replacing plain remove or demote buttons.
- User and clan pickers become searchable async comboboxes (max 20 rows). This replaces the `useEffect` that loads every user into a `<Select>`, which both violates AGENTS.md and bulk-exposes PII.
- Form errors need field-level display, and modals must show the specific failure (forbidden, invalid, not found) rather than a generic "try again".

## Accessibility fixes (apply while building the shared components)

- Remove `<Link><Button/></Link>` nesting; use `Button asChild`.
- Icon or text buttons in rows need unique accessible names (`Edit {name}`), or use the overflow menu.
- Labels on all search inputs; `aria-hidden` on decorative icons.
- `DialogDescription` on every dialog; lock the dialog while a request is pending; initial focus on Cancel for destructive dialogs.
- One `h1` per page. Reset forms when a dialog opens.
- `motion-reduce` and no hover-lift on non-interactive cards.
- Deterministic avatar fallback and `alt=""` on decorative avatars.
- Clamp `?page=` (NaN and negative offsets currently error).

## Phases

| Phase | Scope                                                                                                                                                | Effort | Depends on |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------- |
| 0     | Findings above (S3, S1 default and normalization, S6, X2, X4, X5, X6, `?page=` clamp). Make the user-delete copy truthful in the interim.            | S      | none       |
| 1     | `adminAction` wrapper with Zod and typed results; pagination caps and LIKE escaping; transactions on all mutations; invariant guards; resolve S4/X1. | M      | 0          |
| 2     | Responsive shell, `PageHeader`, `Breadcrumbs`, drop hero panels, fix nested Link/Button.                                                             | M      | none       |
| 3     | `AdminDataTable` with URL state, a11y, loading, error and empty states. Replace the three tables and the members table.                              | L      | 2          |
| 4     | DB-backed admin role, `sessionVersion`, unique lower-case email index (needs a duplicate-cleanup migration). Admins screen.                          | M-L    | 1          |
| 5     | `admin_audit_log`, rate limiting, revalidation helper, audit view and History tabs, reason fields.                                                   | M      | 1, 4       |
| 6     | Destructive-flow redesign: soft delete, impact preview, typed confirmation, step-up auth, Trash view.                                                | L      | 1, 5       |
| 7     | Forms: server-provided options and async comboboxes, reset on open, inline validation, shared edit-dialog shell.                                     | M      | 1, 2       |
| 8     | Detail pages including new `events/[eventId]`; tabbed user and clan pages.                                                                           | L      | 2, 3       |
| 9     | Overview dashboard: real aggregates, needs-attention lists, audit feed.                                                                              | M      | 5          |
| 10    | Optional: bulk actions, filter chips on events. Drop `/api/super-admin/check`, fix or drop the fake `lastSeen`, set `serverActions.allowedOrigins`.  | S-M    | 3          |
| QA    | Keyboard-only and screen-reader pass, 375/768px checks, Playwright smoke tests for each delete flow, unit tests for guard and invariants.            | M      | 2-8        |

Recommended order: 0, then 1, then 2 in parallel with 4, then 3, 5, 6, 7, 8, 9.

## Open decisions for the owner

1. What should deleting a user do with the events they created: reassign, archive, or delete with explicit consent? (Currently it deletes them.)
2. Admin source of truth: a `users.role` column, or a separate `platform_admins` table with grant history?
3. Is soft delete with a purge window acceptable for users and events, given the storage and privacy implications of keeping deleted user data?
4. Are bulk actions needed, or is a per-row flow enough?
5. Should admin email editing be removed entirely, or kept behind verification and a reason?

## Implemented (views rework)

Verified: `eslint` clean on the touched paths, `npm run build` succeeds. `tsc` reports one error in
`src/app/actions/__tests__/user.test.ts`, which also exists on the branch without this rework.
Not verified: Jest (needs Docker) and any browser, keyboard or screen-reader check.

- [x] Phase 0: password hash no longer reaches client components (explicit DTO queries in `src/server/super-admin/queries.ts`), owner sentinel bug, `&apos;` toast, local-time event dates with `end > start` validation, real stat aggregates, `?page=` clamping, truthful user-delete copy with real counts (X1 copy only).
- [x] Phase 2: responsive shell, breadcrumbs and `PageHeader`, nav `aria-current`, `notFound()` for non-admins, nested Link/Button removed.
- [x] Phase 3: shared `AdminDataTable` with URL state, labeled search, `aria-sort`, `<nav>` pagination, `loading.tsx`, `error.tsx`, empty states.
- [x] Phase 7 (partly): server-provided options and comboboxes instead of `useEffect` fetches, reset-on-open, inline validation.
- [x] Phase 8 (partly): `events/[eventId]` page added; user and clan detail pages reworked.
- [x] Phase 9 (partly): overview with real counts.
- [x] ConfirmDestructiveDialog with typed-name confirmation.
- [ ] Backend items that were open here (S1, S2, S5, S6, S7, S9, S12) are covered in the hardening section below; still open: S4 semantics, S8, Phases 4 and 6, and the QA phase.
- Read actions (`getAllUsers`, `getUserDetails`, etc.) were removed from `src/app/actions/super-admin.ts` and replaced by guarded server-only queries, so they are no longer callable as public server actions. Mutation actions were converted in the hardening pass below.

## Implemented (backend hardening, branch `feature/super-admin-hardening`)

Verified: `eslint` clean, `tsc` clean apart from the known `user.test.ts` error, `npm run build` succeeds.
`src/app/actions/__tests__/super-admin-guard.test.ts` (27 tests, mocked DB and session) passed when run
with the Docker-backed global setup replaced by a no-op (`jest --globalSetup <noop> --globalTeardown <noop>`).
Not verified: the rest of the Jest suite (needs Docker), migration `0034` applied to a real database,
any transaction, lock or audit-row behavior against PostgreSQL, and any browser, keyboard or screen-reader check.

- [x] S1, S2, S15: guard rewritten (`src/lib/super-admin.ts`, `src/lib/super-admin-email.ts`). The env list is trimmed, lower-cased and read per call. The admin is resolved from the DB row of `session.user.id`, never from the JWT email, so a deleted user or changed email loses access on the next request. Denials log the user id only. The `admin@example.com` compose fallback is removed.
- [x] S5, S10, S12, S14: `adminAction` (`src/server/super-admin/admin-action.ts`) runs guard, strict zod parse, per-admin rate limit (30/min) and the handler in one `db.transaction`, returning `{ success, error, code }`. All ten mutations use it, with explicit field allowlists, id/length/email/enum/date validation, owner and clan existence checks, and 0 rows affected reported as `not_found`. List search is capped at 100 characters, LIKE wildcards are escaped, non-finite pages are clamped.
- [x] S4 (guards only), S6, S7: no self-delete, no deleting a user on the super-admin list, email edits refused when the old or new address is on the list or already belongs to another user, the clan owner and the only admin of a clan or event cannot be removed or demoted. `deleteUser` still deletes events the user created (unchanged semantics); dependents now rely on `ON DELETE CASCADE`.
- [x] S9: `admin_audit_log` (migration `0034_green_malice`, additive). Success rows are written in the mutation's transaction with allowlisted, masked before/after. Denied attempts by signed-in non-admins and refused/failed mutations are logged best-effort and rate-limited. Guarded `listAuditLog` query and read-only page at `/super-admin/audit`.
- [x] S13: `revalidateAdmin` covers admin overview, audit, list and detail paths, and public `/events` and `/clans`.
- [x] Read actions: `src/app/actions/super-admin.ts` is the only `"use server"` file touching admin data and exports mutations only; reads live in the server-only `queries.ts`.
- [ ] Deferred, needs a product decision or a risky migration:
  - DB-backed admin role or `platform_admins` table (replaces the env list; Phase 4).
  - `sessionVersion` JWT invalidation and a shorter `maxAge`.
  - Unique `lower(email)` index (needs duplicate cleanup on production data first). Until then two user rows can share an email, and both pass the env-list check.
  - Soft delete and trash, impact-preview confirm tokens, mandatory reason field, step-up re-auth (Phase 6).
  - `serverActions.allowedOrigins`.
  - Changing what `deleteUser` does with the user's created events (open decision 1).
  - Per-entity History tabs, an audit feed on the overview, and `user_agent` capture.
