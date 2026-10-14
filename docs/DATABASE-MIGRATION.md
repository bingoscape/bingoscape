# Database Migration Guide

Migrate your database from the old production server (non-Docker PostgreSQL) to the new Docker-based deployment.

## Overview

This guide covers migrating your PostgreSQL database using backup and restore scripts.

**Timeline**: ~30-60 minutes (depending on database size)

---

## Prerequisites

- **Old Server**: SSH access with PostgreSQL installed
- **New Server**: Docker deployment fully configured and running
- **Network**: Ability to transfer files between servers (or via local machine)

---

## Migration Process

### Step 1: Backup Old Database

SSH into your **old production server** and run:

```bash
# Option 1: If scripts are already on old server
cd /path/to/bingoscape
./scripts/backup-old-db.sh

# Option 2: Run backup command directly
mkdir -p ~/db-backups
pg_dump -U postgres --clean --if-exists --no-owner --no-privileges bingoscape | \
  gzip > ~/db-backups/bingoscape-backup-$(date +%Y%m%d_%H%M%S).sql.gz
```

**Output**: Creates compressed backup file at `~/db-backups/bingoscape-backup-TIMESTAMP.sql.gz`

**Verify backup**:

```bash
# Check file exists and has reasonable size
ls -lh ~/db-backups/
gunzip -t ~/db-backups/bingoscape-backup-*.sql.gz  # Test integrity
```

---

### Step 2: Transfer Backup to New Server

Choose one of these methods:

#### Method A: Direct SCP Transfer

```bash
# From old server to new server
scp ~/db-backups/bingoscape-backup-*.sql.gz user@new-server:~/bingoscape/backups/
```

#### Method B: Via Local Machine

```bash
# Download from old server
scp user@old-server:~/db-backups/bingoscape-backup-*.sql.gz ./

# Upload to new server
scp ./bingoscape-backup-*.sql.gz user@new-server:~/bingoscape/backups/
```

#### Method C: Using rsync (for large databases)

```bash
rsync -avz --progress \
  ~/db-backups/bingoscape-backup-*.sql.gz \
  user@new-server:~/bingoscape/backups/
```

---

### Step 3: Prepare New Server

SSH into your **new server** and ensure Docker deployment is ready:

```bash
cd ~/bingoscape

# Verify containers are running
docker compose ps

# If not running, start them
docker compose up -d

# Create backups directory
mkdir -p backups
```

---

### Step 4: Import Database

On the **new server**, run the import script:

```bash
cd ~/bingoscape

# List available backups
ls -lh backups/

# Import the backup
./scripts/import-db.sh backups/bingoscape-backup-TIMESTAMP.sql.gz
```

**What the script does**:

1. Stops the application container (to prevent connections during import)
2. Imports backup into PostgreSQL Docker container
3. Restarts application container

**You'll be prompted to confirm** - type `yes` to proceed.

---

### Step 5: Verification

After import completes, verify the migration:

```bash
# Check containers are running
docker compose ps

# Verify tables exist
docker compose exec postgres psql -U postgres -d bingoscape -c "\dt bingoscape-next_*"

# Check table counts (compare with old server)
docker compose exec postgres psql -U postgres -d bingoscape -c "
  SELECT schemaname, tablename,
         (SELECT count(*) FROM bingoscape-next_users) as user_count,
         (SELECT count(*) FROM bingoscape-next_events) as event_count;
"

# View application logs for errors
docker compose logs app --tail=50

# Test the application
curl -I https://your-domain.com
```

---

## Troubleshooting

### Import Fails with "database does not exist"

**Solution**: Create the database first:

```bash
docker compose exec postgres psql -U postgres -c "CREATE DATABASE bingoscape;"
./scripts/import-db.sh backups/bingoscape-backup-*.sql.gz
```

### Import Fails with Permission Errors

**Solution**: Ensure `.env` file has correct database credentials:

```bash
cat .env | grep DB_
# Should show DB_USER=postgres and DB_NAME=bingoscape
```

### "No space left on device"

**Solution**: Check disk space and clean up:

```bash
df -h
docker system prune -a  # Clean up unused Docker data
```

### Application Won't Start After Import

**Solution**: Check for migration issues:

```bash
# View detailed logs
docker compose logs app

# Restart all services
docker compose restart

# If needed, run migrations
docker compose run --rm migrate
```

### Backup File Corrupted

**Solution**: Verify integrity and re-create:

```bash
# Test backup file
gunzip -t backups/bingoscape-backup-*.sql.gz

# If corrupted, create new backup from old server
```

---

## Rollback Procedure

If migration fails and you need to rollback:

### On New Server:

```bash
# Stop containers
docker compose down

# Remove database volume (WARNING: deletes all data)
docker volume rm bingoscape_postgres_data

# Restart with fresh database
docker compose up -d

# Try import again or restore from a previous backup
```

---

## Post-Migration Checklist

- [ ] All containers running: `docker compose ps`
- [ ] Database tables present: Check with `\dt` command
- [ ] Application accessible via browser
- [ ] User login works
- [ ] Key functionality tested (create event, submit, etc.)
- [ ] Uploads directory has correct permissions (775)
- [ ] SSL certificates working
- [ ] No errors in logs: `docker compose logs`

---

## Best Practices

### Before Migration

1. **Announce downtime** to users
2. **Test migration** on a staging environment first
3. **Backup new server's database** before import (if it has data)
4. **Document old server credentials** for reference

### During Migration

1. **Monitor import progress** - large databases take time
2. **Keep backup file** until migration is verified
3. **Don't delete old database** immediately

### After Migration

1. **Keep old server running** for 24-48 hours as fallback
2. **Monitor application logs** for unexpected errors
3. **Backup new database** immediately after successful migration
4. **Update DNS** only after full verification

---

## Database Size Estimates

Import time estimates based on database size:

- **< 100 MB**: 1-2 minutes
- **100 MB - 1 GB**: 5-15 minutes
- **1 GB - 10 GB**: 15-60 minutes
- **> 10 GB**: 1+ hours

**Progress monitoring**:

```bash
# Watch import progress in real-time
docker compose logs -f postgres
```

---

## Alternative: Manual Migration

If scripts don't work, you can migrate manually:

### Backup (old server):

```bash
pg_dump -U postgres bingoscape > /tmp/backup.sql
gzip /tmp/backup.sql
```

### Import (new server):

```bash
gunzip -c backup.sql.gz | docker compose exec -T postgres psql -U postgres -d bingoscape
```

---

## RBAC 2/8 rollout (migration `0038_rbac_membership_integrity`)

Phase 2 of the RBAC consolidation (epic #183, issue #185). Expand-only: no column or table is dropped, and the previous app version keeps working against the new schema (rollback of the app image is safe; the database is not reverted).

**What it does**

| Step | Effect |
| ---- | ------ |
| Participants | Removes duplicate `event_participants` rows (keeps the highest role, then the oldest), re-points their buy-ins and donations to the keeper, copies the removed rows to `event_participants_quarantine`, then adds unique `(event_id, user_id)`. |
| Team members | Adds nullable `team_members.event_id`, backfills it from `teams`, removes duplicate rows (leader row first, then oldest) into `team_members_quarantine`, then adds unique `(team_id, user_id)` and unique `(event_id, user_id)` (a Player is on one Team per Event, as `CONTEXT.md` and the app already assume), and a composite foreign key `(team_id, event_id)` to `teams` that keeps `event_id` equal to the Team's Event. |
| Indexes | `event_participants(user_id)`, partial `event_participants(user_id, event_id)` for `admin`/`management`, `team_members(user_id)`. Plain `CREATE INDEX`: drizzle runs a migration in one transaction, where `CONCURRENTLY` is not allowed. The tables are small, so the short write lock is acceptable. |
| Creators | Inserts an `admin` participant row for every Event whose creator has none (ledger action `backfill`). Existing non-admin creator rows are left alone and reported by `creator_role_conflicts`. |
| Ledger | New `role_change_log` (one `baseline` row per existing Event and Clan membership) and `event_audit_log`, both without foreign keys and with CHECK constraints on the enumerated columns. Not written by the app yet (RBAC 3/8). |
| Users | Unique `users_username_unique` and `users_email_unique`, created **only if the column has no duplicates**; otherwise the migration logs a `NOTICE` and skips that index, so a deploy never fails on dirty user data. |

Every statement is idempotent, so re-running the migration (`migrate.yml`) is a no-op.

**Compatibility with the previous app version.** It inserts `team_members` without `event_id` (NULL is tolerated by every constraint) and inserts participants without `ON CONFLICT`; a racing duplicate join then fails with a unique violation instead of creating a duplicate row. The new app fills `event_id` and uses `ON CONFLICT DO NOTHING`. `NOT NULL` on `team_members.event_id` follows in RBAC 8/8, after re-running the backfill:

```sql
UPDATE "bingoscape-next_team_members" tm SET event_id = t.event_id
FROM "bingoscape-next_teams" t WHERE tm.team_id = t.id AND tm.event_id IS NULL;
```

Memberships created by the previous app after this migration have no ledger row until migration 0039 (RBAC 3/8) baselines them; `ledger_drift` reports them until then.

**Before deploying: verify on a restored production backup** (see `scripts/restore-db.sh`, or restore into a scratch database):

```bash
DATABASE_URL=postgres://.../scratch npm run db:verify-rbac   # before: the duplicate checks list the rows 0038 will clean up; the ledger and event_id checks print ERR (their tables do not exist yet)
# run the migration against the scratch database, then:
DATABASE_URL=postgres://.../scratch npm run db:verify-rbac   # after: no FAIL lines except documented exceptions
```

The checks live in `src/server/authz/verification.ts` (the same module becomes the ledger reconciliation job in RBAC 3/8). Documented exceptions after the migration, which are reported but never auto-fixed: `events_without_admin` (Events without a creator and without an admin), `creator_role_conflicts` (creator with an explicit non-admin role; the policy treats the creator as admin), `team_members_not_participants`, and the `warn` checks below.

**Resolving duplicate usernames and emails.** The app lowercases usernames and looks them up with an exact match; NextAuth looks emails up exactly. The indexes therefore cover the raw columns. If `duplicate_usernames` / `duplicate_emails` return rows, the migration skipped the index. Fix the accounts (rename, merge by hand, or null the stale email), then create the index; `IF NOT EXISTS` makes this safe to repeat:

```sql
SELECT username, count(*) FROM "bingoscape-next_user" WHERE username IS NOT NULL GROUP BY 1 HAVING count(*) > 1;
CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "bingoscape-next_user" ("username");
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "bingoscape-next_user" ("email");
```

Emails that differ only in letter case do not block the index; `duplicate_emails_ignoring_case` lists them for review.

**Quarantine and rollback.** Nothing is lost silently: removed rows are in `event_participants_quarantine` and `team_members_quarantine` (with the id of the row that was kept and, for Teams, the kept Team). If a kept Team is wrong, move the Player back by hand and delete the quarantine row. To undo the data changes, restore the pre-deploy backup (`scripts/restore-db.sh`); rolling back only the app image leaves the new tables and constraints in place, which the previous version tolerates.

**Retention and erasure.** `event_audit_log` and `role_change_log` are meant to be kept `EVENT_AUDIT_RETENTION_DAYS` (365, `src/server/authz/audit-log.ts`; pending the maintainer's answer on decision 10 of #183). No purge job exists yet. They hold user ids without foreign keys, so a user-erasure request is served by setting `actor_user_id` / `subject_user_id` to `NULL` on that user's rows.

## RBAC 3/8 rollout (migration `0039_rbac_role_change_trigger`)

Phase 3 of the RBAC consolidation (epic #183, issue #186). Add-first and compatible with the previous app version (rolling the app image back is safe; the database is not reverted).

| Part | Effect |
| ---- | ------ |
| `role_change_log.source` | The CHECK constraint accepts the new source `trigger` (drop and re-add of `role_change_log_source_check`). |
| Ledger catch-up | Memberships created, changed or removed by the previous app between 0038 and 0039 have no or a stale ledger entry. The migration writes one `baseline` / `backfill` / `remove` row (source `migration`) for each, so `ledger_drift` is empty right after the deploy. A second run finds nothing to do. |
| Safety-net trigger | `AFTER INSERT OR UPDATE OF role OR DELETE` on `event_participants` and `clan_members` (function `bingoscape_next_log_membership_change`). It writes a ledger row with source `trigger` for any write that did not come through `changeRole()` and its siblings, for example the previous app version. |

**No double logging.** The membership helper sets the transaction-local setting `app.audit_source` (`set_config(..., true)`) before it writes and inserts its own ledger row; the trigger returns early when the setting is non-empty. The helper resets the setting when its operation is done, so later writes in the same transaction are still caught. Deleting an Event, a Clan or a user cascades to the membership rows; the trigger skips those deletes (the parent or the user no longer exists), as does the reconciliation query.

Every statement is idempotent. To switch the trigger off in an emergency: `ALTER TABLE "bingoscape-next_event_participants" DISABLE TRIGGER event_participants_role_ledger;` (and `clan_members_role_ledger` on `bingoscape-next_clan_members`); the next reconciliation run then reports ledger drift for writes made in the meantime.

**Daily reconciliation.** The verification queries of `src/server/authz/verification.ts` run once a day through `GET /api/cron/rbac-reconcile` (bearer `CRON_SECRET`, like `/api/cron/unlock`). It answers `200` when every `error` check is empty and `500` with the first rows of each finding otherwise. `scripts/rbac-reconcile.sh` calls it from host cron, appends the result to `backups/rbac-reconcile.log` and posts failures to Discord when `BACKUP_ALERT_WEBHOOK_URL` is set in the server `.env` (the variable the backups already use). Install once on the server:

```bash
./scripts/setup-rbac-reconcile-cron.sh   # daily at 4:00 AM, after the 3:00 AM backup
./scripts/rbac-reconcile.sh              # run it by hand
```

Without `CRON_SECRET` the route answers `401` and the script reports that it cannot run. Findings are fixed by hand (see "RBAC 2/8 rollout" for the duplicate and quarantine checks); the job never repairs data.

**Ownership rules the app now enforces** (all in `src/server/authz/membership.ts`): an Event and a Clan always keep an admin; the Event creator and the Clan owner can be neither demoted nor removed (transfer ownership first); nobody grants or adds a role above their own; deleting an Event, granting the admin role and transferring ownership are owner-only. For an Event whose creator account is gone (`creator_id` is null), its oldest admin acts as the owner for the owner-only actions. Existing data that already violates an invariant is not changed; the reconciliation reports it (for example `events_without_admin`, `creator_role_conflicts`).

## Team draft rollout (migration `0041_team_draft`)

Team draft 1/4 (epic #214, issue #215). Expand-only and compatible with the previous app version (rolling the app image back is safe; the database is not reverted). Every statement is idempotent, so re-running the file is a no-op. `teams`, `team_members` and every other existing table are untouched; a test (`src/server/__tests__/draft-migration.test.ts`) checks that only the five new tables appear.

| Table | Purpose |
| ----- | ------- |
| `draft` | One draft per Event: `status`, order, rounds, pick timer settings, `current_pick_no`, `version`, `seed`. A partial unique index allows one non-cancelled draft per Event; `(id, event_id)` is unique so the child tables can reference both. |
| `draft_team_slot` | One captain's place in the order, and the Team (`team_id`, set when the draft starts). |
| `draft_pool_entry` | A player of the frozen pool with the rating snapshot (`rating_source` = `team_balancing_v1`). |
| `draft_pick` | A pick. Unique `(draft_id, pick_no)` and `(draft_id, pool_entry_id)`; composite foreign keys keep the slot and the pool entry inside the pick's draft. |
| `draft_event` | Append-only log with an identity `seq`, written in the same transaction as the change it records. |

Enumerated columns are `text` with CHECK constraints (status, order type, timeout behaviour, auto-pick rule, pool status, ranges); drizzle-kit 0.24 does not emit CHECKs, so they are added by hand at the end of the file. References to users are `ON DELETE SET NULL` (a draft survives the erasure of an account); `draft_event.actor_user_id` has no foreign key at all so a row can be anonymised.

**Compatibility.** Nothing reads or writes these tables before the new app runs, and the new app only writes `team_members` through `src/server/authz/team-membership.ts`, with `event_id` set (the same as every other writer since 0038). The previous app version keeps inserting `team_members` without `event_id`; the draft's "already on a Team" check joins through `teams` for that reason.

**Rollback.** The app image can be rolled back freely. A draft that is `in_progress` then simply sits there (nobody can pick); its Teams and captain memberships stay. Cancel it from the new version, or delete the Teams by hand. The tables can stay empty and unused indefinitely.

## Team draft timer rollout (migration `0042_team_draft_timer`)

Team draft 3/4 (epic #214, issue #217): pick timer, auto-pick, pause and undo. Expand-only and compatible with the previous app version (rolling the app image back is safe; the database is not reverted). Every statement is idempotent. A test (`src/server/__tests__/draft-timer-migration.test.ts`) applies it to a database at 0041 and checks all of the below.

| Change | Purpose |
| ------ | ------- |
| `draft.paused_remaining_ms` (nullable) | The time left on the turn when the draft was paused; resume restores it. `turn_deadline` is NULL while paused. |
| `draft_team_slot.consecutive_timeouts` (`NOT NULL DEFAULT 0`) | Turns in a row a captain let the timer run out; at 2 the room flags the captain for the manager. |
| `draft_pick.undone_at` (nullable) | Undo is a soft delete: the row stays for the audit trail. |
| `draft_pick_draft_pick_no_unique`, `draft_pick_draft_pool_entry_unique` | Recreated as **partial** unique indexes (`WHERE undone_at IS NULL`), so an undone pick frees its number and its player. They are dropped and created in the same transaction. |
| `draft_queue_entry` (new table) | A captain's private pick queue; composite foreign keys keep it inside its draft. |

**Compatibility.** The previous app version never sets `undone_at` and hard-deletes on undo, so for it the partial indexes behave exactly like the full ones. It does not know the new columns (they are nullable or defaulted) or the new table. A draft that is `in_progress` with a pick timer configured but no `turn_deadline` (started by the previous version) is armed by the new version the first time it is read or swept: the turn is timed from then on.

**Rollback.** The app image can be rolled back freely. Rows with `undone_at` set are invisible to the previous version only through its own queries: it reads every `draft_pick` row, so an undone pick would show again there. Finish or cancel a draft with undone picks before rolling back, or delete the rows with `undone_at IS NOT NULL` by hand.

**The timer needs a long-lived process.** The sweeper (once per second, `pg_try_advisory_xact_lock`) starts from `src/instrumentation.ts` in the Node server, like the SSE hub. It also resolves turns that expired during a deploy as soon as the new container is up. Expired turns are additionally resolved lazily on every pick, state read and stream connect, so a missing sweeper only delays an AFK captain's auto-pick until somebody looks at the draft. `GET /api/cron/draft-sweep` (bearer `CRON_SECRET`, same as the other cron routes) runs the same sweep and can be called from host cron as a backstop:

```bash
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/draft-sweep
```

## RBAC 7/8 rollout (migration `0040_credential_session_hygiene`)

Phase 7 of the RBAC consolidation (epic #183, issue #190): credential and session hygiene. Add-first and compatible with the previous app version (rolling the app image back is safe; the database is not reverted). Every statement is idempotent.

| Part | Effect |
| ---- | ------ |
| `api_keys.key` | `NOT NULL` is dropped (the `UNIQUE` constraint stays). New keys leave it `NULL`; the previous app always supplies it and reads it with `WHERE key = ...`, both unaffected. **The legacy plaintext column is not dropped or emptied**; that is RBAC 8/8. |
| `api_keys.key_hash`, `key_prefix` | SHA-256 (lower-case hex) of the key and its first 8 characters. Unique index `api_keys_key_hash_unique`. |
| Backfill | `UPDATE ... SET key_hash = encode(sha256(convert_to(key, 'UTF8')), 'hex'), key_prefix = left(key, 8)` for every existing key. PostgreSQL 11+ has the built-in `sha256(bytea)`, so **no `pgcrypto` extension is needed**. Keys the previous app creates after the migration have no hash; the new app backfills them on first use (see below). |
| `api_keys.scopes`, `expires_at`, `revoked_at` | `scopes text[] NOT NULL DEFAULT '{read,submit}'`, so every existing key keeps full access; `expires_at` / `revoked_at` are nullable. |
| `user.session_revoked_at` | Nullable. Sessions issued before this instant are rejected ("sign out everywhere"). NULL for everybody after the migration, so **no session is invalidated by the deploy**. |
| `user.provider_verified_email` | Nullable. The email an OAuth provider vouched for at the last sign-in (see "Super admins" below). |

**Dual-read of API keys (one release).** A key is looked up by its hash first; if there is no row, by the legacy `key` column. A legacy hit writes the hash and prefix back (`checkApiKey` in `src/lib/api-auth.ts`). Revocation, expiry and scope are checked on both paths, and a revoked row found by hash is never revived through its plaintext. Existing keys and RuneLite plugin clients keep working unchanged: the key format (`bsn_` + 32 characters) and the `Authorization: Bearer` header did not change.

**Rolling back the app image.** Keys created by the new app have `key = NULL`, so the **previous app version cannot validate them** (it only knows the plaintext column). The owner has to create a new key after a rollback. Keys that existed before the deploy keep working on both versions. `revoked_at`, `expires_at` and `scopes` are unknown to the previous app: a key revoked or expired in the new app **works again** in the previous version until it is deleted. Delete the key instead of revoking it if a rollback is likely.

**Rollout checklist.**

```sql
-- after the migration: every key that had a plaintext value has a hash
SELECT count(*) FROM "bingoscape-next_api_keys" WHERE key IS NOT NULL AND key_hash IS NULL;  -- expect 0
SELECT count(*) FROM "bingoscape-next_api_keys" WHERE key_hash IS NOT NULL AND key IS NULL;   -- keys created by the new app
```

RBAC 8/8 drops `api_keys.key` after one release; before that, run the first query again (keys created by the previous app after 0040 and never used are the only ones without a hash; they are backfilled on first use or can be backfilled with the `UPDATE` in the migration file).

**Super admins must sign in through their provider once.** `SUPER_ADMIN_EMAILS` stays env-only (decision 2 of #183 is open), but an address on the list now only counts when it equals `users.provider_verified_email`, which the app sets at each OAuth sign-in from the provider's own verification flag (Discord `verified`, Google `email_verified`, GitHub public or verified primary email). It is deliberately **not backfilled**: `users.email_verified` defaults to `CURRENT_TIMESTAMP` and says nothing. Until a super admin has signed in with Discord, GitHub or Google after this deploy, `/super-admin` denies them (their normal account keeps working). Credentials accounts and unverified provider emails can never be super admins, which closes the case of a self-registered account carrying an allowlisted address. To grant by hand in an emergency: `UPDATE "bingoscape-next_user" SET provider_verified_email = lower(email) WHERE id = '<uuid>';`.

**Sessions.** The JWT is now only a pointer to the user (id and issue time). On every request the user row is read by primary key (one lookup, memoised per request): a deleted account, or a token older than `session_revoked_at`, is rejected and its cookie cleared; the `runescapeName` in the session comes from the database, not from the token or from `useSession().update()`. The lifetime is explicit (30 days, extended at most once a day). Existing sessions stay valid. Setting a user's `session_revoked_at = now()` signs them out everywhere; the profile settings page has a button for it.

**Rate limits and the proxy.** Limits are in `src/lib/rate-limit-policies.ts`. They assume **one app instance** (decision 9 of #183): counters live in process memory and reset on restart. For a client IP the app trusts only the **last** entry of `X-Forwarded-For`, i.e. the address the host nginx appended (`proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`, as in `docs/PRODUCTION-SETUP.md`). If nginx is ever configured differently, or another proxy sits in front of it, anonymous limits (sign-in, sign-up, `/api/runelite/auth`, invite lookups) apply per proxy address instead of per client.

**Content-Security-Policy.** `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin` are sent on every response. The CSP ships as `Content-Security-Policy-Report-Only` by default because it was not verified against every page of the running app. Browse the main pages with the browser console open; when it shows no violations set `CSP_MODE=enforce` in the server `.env` (GitHub secret `CSP_MODE`) and restart the container, no rebuild needed. `CSP_MODE=off` removes the header.

**Rollback of the schema** is not needed and not offered: the new columns are ignored by the previous app. To undo the data effects only, restore the pre-deploy backup (`scripts/restore-db.sh`).

---

## Need Help?

1. Check logs: `docker compose logs`
2. Verify database connection: `docker compose exec postgres psql -U postgres`
3. Review PostgreSQL logs: `docker compose logs postgres`
4. Check disk space: `df -h`

---

## Quick Reference

### Useful Commands

```bash
# Backup database (old server)
./scripts/backup-old-db.sh

# Import database (new server)
./scripts/import-db.sh backups/file.sql.gz

# Access database shell
docker compose exec postgres psql -U postgres -d bingoscape

# List all tables
docker compose exec postgres psql -U postgres -d bingoscape -c '\dt'

# Check database size
docker compose exec postgres psql -U postgres -d bingoscape -c "
  SELECT pg_size_pretty(pg_database_size('bingoscape'));"

# Restart all services
docker compose restart
```
