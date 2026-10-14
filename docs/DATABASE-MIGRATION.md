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

Memberships created by the previous app after this migration have no ledger row until RBAC 3/8 baselines them; `ledger_drift` reports them until then.

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
