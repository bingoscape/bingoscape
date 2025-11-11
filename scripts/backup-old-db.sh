#!/bin/bash
set -e

# =============================================================================
# Backup Database from Old Production Server
# =============================================================================
# Run this on your OLD production server (non-Docker PostgreSQL)
# Creates a compressed backup file that can be imported into new Docker setup
# =============================================================================

# Configuration (update these values for your old server)
DB_NAME="${DB_NAME:-bingoscape}"
DB_USER="${DB_USER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-~/db-backups}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/bingoscape-backup-$TIMESTAMP.sql.gz"

echo "🗄️  Database Backup Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Database: $DB_NAME"
echo "User: $DB_USER"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo "❌ Error: pg_dump not found. Please install postgresql-client."
    exit 1
fi

echo "📦 Creating database backup..."
echo "This may take a few minutes depending on database size..."
echo ""

# Create backup with pg_dump
# --clean: Add DROP statements before CREATE
# --if-exists: Use IF EXISTS with DROP statements
# --no-owner: Don't output commands to set ownership
# --no-privileges: Don't output commands to set privileges
if pg_dump -U "$DB_USER" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
    "$DB_NAME" | gzip > "$BACKUP_FILE"; then

    echo "✅ Backup created successfully!"
    echo ""
    echo "📊 Backup Details:"
    echo "  File: $BACKUP_FILE"
    echo "  Size: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo ""

    # Show file listing
    ls -lh "$BACKUP_FILE"
    echo ""

    echo "📤 Next Steps:"
    echo ""
    echo "1. Copy this backup file to your new server:"
    echo "   scp $BACKUP_FILE user@new-server:~/bingoscape/backups/"
    echo ""
    echo "2. Or download it locally first:"
    echo "   scp user@old-server:$BACKUP_FILE ./bingoscape-backup.sql.gz"
    echo ""
    echo "3. Then upload to new server:"
    echo "   scp ./bingoscape-backup.sql.gz user@new-server:~/bingoscape/backups/"
    echo ""
    echo "4. Run the import script on the new server:"
    echo "   cd ~/bingoscape"
    echo "   ./scripts/import-db.sh backups/bingoscape-backup-$TIMESTAMP.sql.gz"
    echo ""
else
    echo "❌ Backup failed!"
    exit 1
fi
