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
