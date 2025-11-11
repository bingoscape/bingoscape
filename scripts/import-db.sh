#!/bin/bash
set -e

# =============================================================================
# Import Database into New Docker PostgreSQL
# =============================================================================
# Run this on your NEW server (Docker-based deployment)
# Imports a backup file into the Docker PostgreSQL container
# =============================================================================

BACKUP_FILE="$1"

if [ -z "$BACKUP_FILE" ]; then
    echo "❌ Error: No backup file specified"
    echo ""
    echo "Usage: $0 <backup-file>"
    echo ""
    echo "Example:"
    echo "  $0 backups/bingoscape-backup-20250111_150000.sql.gz"
    echo ""
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "🗄️  Database Import Script"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Backup file: $BACKUP_FILE"
echo "Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
echo ""

# Check if docker compose is available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: docker not found"
    exit 1
fi

# Check if postgres container is running
if ! docker compose ps postgres | grep -q "Up"; then
    echo "❌ Error: PostgreSQL container is not running"
    echo "Start it with: docker compose up -d postgres"
    exit 1
fi

echo "⚠️  WARNING: This will replace all data in the database!"
echo ""
read -p "Are you sure you want to continue? (yes/no): " -r
echo ""

if [ "$REPLY" != "yes" ]; then
    echo "❌ Import cancelled"
    exit 1
fi

# Get database credentials from .env or use defaults
DB_NAME="${DB_NAME:-bingoscape}"
DB_USER="${DB_USER:-postgres}"

echo "📊 Database Import Steps:"
echo "1. Stopping application container..."
docker compose stop app

echo "2. Importing backup into PostgreSQL container..."
echo "   This may take several minutes..."
echo ""

# Import the backup
# - Decompress the gzipped file
# - Pipe directly into docker exec psql
if gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME"; then
    echo ""
    echo "✅ Database import successful!"
    echo ""
else
    echo ""
    echo "❌ Database import failed!"
    echo ""
    echo "Troubleshooting:"
    echo "  - Check if backup file is corrupted: gunzip -t $BACKUP_FILE"
    echo "  - Check postgres logs: docker compose logs postgres"
    echo "  - Verify database credentials in .env file"
    echo ""
    exit 1
fi

echo "3. Restarting application container..."
docker compose start app

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Database migration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Next steps:"
echo "1. Verify application is working: docker compose ps"
echo "2. Check application logs: docker compose logs app"
echo "3. Test the application in your browser"
echo ""
echo "If you encounter issues:"
echo "  - View database logs: docker compose logs postgres"
echo "  - Access database shell: docker compose exec postgres psql -U $DB_USER -d $DB_NAME"
echo "  - Check tables: docker compose exec postgres psql -U $DB_USER -d $DB_NAME -c '\dt bingoscape-next_*'"
echo ""
