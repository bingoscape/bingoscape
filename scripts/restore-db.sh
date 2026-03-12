#!/bin/bash
set -e

# =============================================================================
# PostgreSQL Database Restore Script for Bingoscape
# =============================================================================
# Restores database from a backup file with safety checks
# Creates a safety backup before restore for rollback capability
# Usage: ./restore-db.sh <backup-file>
# =============================================================================

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Database credentials (from .env or defaults)
DB_NAME="${DB_NAME:-bingoscapenext}"
DB_USER="${DB_USER:-bingoscapenext}"
CONTAINER_NAME="bingoscape-postgres"
APP_CONTAINER_NAME="bingoscape-app"

# Backup file from command line argument
BACKUP_FILE="$1"

# =============================================================================
# Helper Functions
# =============================================================================

log_message() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
}

log_info() {
    log_message "INFO" "$@"
}

log_error() {
    log_message "ERROR" "$@"
}

log_success() {
    log_message "SUCCESS" "$@"
}

log_warning() {
    log_message "WARNING" "$@"
}

show_usage() {
    cat <<EOF
🗄️  Bingoscape Database Restore Script

Usage: $0 <backup-file>

Arguments:
  backup-file    Path to the backup file to restore (.sql.gz)

Examples:
  $0 backups/daily/daily-2026-03-12.sql.gz
  $0 backups/pre-deploy/pre-deploy-20260312_093636-abc123f.sql.gz
  $0 backups/weekly/weekly-2026-03-10.sql.gz

Available backups:
EOF
    
    echo ""
    echo "Recent daily backups:"
    ls -1th "$BACKUP_BASE_DIR/daily/"*.sql.gz 2>/dev/null | head -5 || echo "  (none)"
    
    echo ""
    echo "Recent pre-deploy backups:"
    ls -1th "$BACKUP_BASE_DIR/pre-deploy/"*.sql.gz 2>/dev/null | head -5 || echo "  (none)"
    
    echo ""
    echo "Recent weekly backups:"
    ls -1th "$BACKUP_BASE_DIR/weekly/"*.sql.gz 2>/dev/null | head -3 || echo "  (none)"
    
    echo ""
}

validate_backup_file() {
    log_info "Validating backup file..."
    
    # Check if backup file was provided
    if [ -z "$BACKUP_FILE" ]; then
        log_error "No backup file specified"
        show_usage
        exit 1
    fi
    
    # Check if file exists
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file does not exist: $BACKUP_FILE"
        exit 1
    fi
    
    # Check if file is readable
    if [ ! -r "$BACKUP_FILE" ]; then
        log_error "Backup file is not readable: $BACKUP_FILE"
        exit 1
    fi
    
    # Test gzip integrity
    if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        exit 1
    fi
    
    local file_size=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Backup file validated: $BACKUP_FILE (size: $file_size)"
}

check_containers() {
    log_info "Checking Docker containers..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi
    
    # Check if postgres container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "PostgreSQL container '$CONTAINER_NAME' is not running."
        log_error "Start it with: docker compose up -d postgres"
        exit 1
    fi
    
    log_success "Container checks passed"
}

show_warning() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚠️  WARNING: DATABASE RESTORE OPERATION"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This will REPLACE ALL DATA in the current database with data from:"
    echo "  $BACKUP_FILE"
    echo ""
    echo "Backup details:"
    echo "  File size: $(du -h "$BACKUP_FILE" | cut -f1)"
    echo "  Created:   $(stat -c %y "$BACKUP_FILE" 2>/dev/null || stat -f "%Sm" "$BACKUP_FILE" 2>/dev/null || echo "Unknown")"
    echo ""
    echo "Current database:"
    echo "  Database:  $DB_NAME"
    echo "  Container: $CONTAINER_NAME"
    echo ""
    echo "Steps that will be performed:"
    echo "  1. Create safety backup of current database"
    echo "  2. Stop application container"
    echo "  3. Restore backup to database"
    echo "  4. Verify restoration"
    echo "  5. Restart application container"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

confirm_restore() {
    read -p "Do you want to continue? Type 'yes' to proceed: " -r
    echo ""
    
    if [ "$REPLY" != "yes" ]; then
        log_warning "Restore cancelled by user"
        exit 0
    fi
    
    log_info "User confirmed restore operation"
}

create_safety_backup() {
    log_info "Creating safety backup of current database..."
    
    local safety_backup_dir="$BACKUP_BASE_DIR/pre-restore"
    mkdir -p "$safety_backup_dir"
    
    local safety_backup_file="$safety_backup_dir/pre-restore-${TIMESTAMP}.sql.gz"
    
    if docker exec "$CONTAINER_NAME" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        2>/dev/null | gzip > "$safety_backup_file"; then
        
        local file_size=$(du -h "$safety_backup_file" | cut -f1)
        log_success "Safety backup created: $safety_backup_file (size: $file_size)"
        echo "$safety_backup_file"
    else
        log_error "Failed to create safety backup"
        log_error "Aborting restore for safety"
        exit 1
    fi
}

stop_application() {
    log_info "Stopping application container..."
    
    # Check if app container is running
    if docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER_NAME}$"; then
        docker compose -f "$APP_DIR/docker-compose.yml" stop app 2>/dev/null || true
        log_success "Application container stopped"
    else
        log_info "Application container is not running"
    fi
}

restore_database() {
    local backup_file="$1"
    
    log_info "Restoring database from backup..."
    log_info "This may take several minutes for large databases..."
    echo ""
    
    # Restore the backup
    if gunzip -c "$backup_file" | docker exec -i "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" 2>&1 | \
        grep -v "^DROP" | grep -v "^CREATE" | grep -v "^ALTER" | grep -v "^COPY" | grep -v "^SET"; then
        
        echo ""
        log_success "Database restore completed"
        return 0
    else
        echo ""
        log_error "Database restore failed"
        return 1
    fi
}

verify_restore() {
    log_info "Verifying database restoration..."
    
    # Test database connection
    if ! docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; then
        log_error "Database connection test failed"
        return 1
    fi
    
    # Count tables
    local table_count=$(docker exec "$CONTAINER_NAME" psql -U "$DB_USER" -d "$DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'bingoscape-next_%'" 2>/dev/null | tr -d ' ')
    
    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        log_error "No tables found after restore"
        return 1
    fi
    
    log_success "Database verification passed (found $table_count tables)"
    return 0
}

start_application() {
    log_info "Starting application container..."
    
    docker compose -f "$APP_DIR/docker-compose.yml" start app 2>/dev/null || \
        docker compose -f "$APP_DIR/docker-compose.yml" up -d app 2>/dev/null || true
    
    # Wait a moment for container to start
    sleep 3
    
    if docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER_NAME}$"; then
        log_success "Application container started"
    else
        log_warning "Application container may not have started correctly"
        log_info "Check status with: docker compose ps"
    fi
}

show_restore_summary() {
    local safety_backup="$1"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ DATABASE RESTORE COMPLETED SUCCESSFULLY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Restore Details:"
    echo "  Source:   $BACKUP_FILE"
    echo "  Database: $DB_NAME"
    echo "  Time:     $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    echo "Safety Backup (for rollback):"
    echo "  $safety_backup"
    echo ""
    echo "Next Steps:"
    echo "  1. Verify application: docker compose ps"
    echo "  2. Check logs:         docker compose logs app"
    echo "  3. Test application:   Visit your site and verify functionality"
    echo ""
    echo "If you need to rollback this restore:"
    echo "  $0 $safety_backup"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🗄️  Bingoscape Database Restore Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log_info "Starting at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Validate backup file
    validate_backup_file
    
    # Check containers
    check_containers
    
    # Show warning and get confirmation
    show_warning
    confirm_restore
    
    # Create safety backup
    SAFETY_BACKUP=$(create_safety_backup)
    
    # Stop application
    stop_application
    
    # Restore database
    if ! restore_database "$BACKUP_FILE"; then
        log_error "Restore failed!"
        log_info "Rolling back using safety backup..."
        
        # Attempt to restore safety backup
        if restore_database "$SAFETY_BACKUP"; then
            log_success "Rollback successful - database restored to pre-restore state"
        else
            log_error "Rollback failed! Database may be in inconsistent state"
            log_error "Manual intervention required"
        fi
        
        start_application
        exit 1
    fi
    
    # Verify restore
    if ! verify_restore; then
        log_error "Restore verification failed!"
        log_warning "Database may be in inconsistent state"
        log_info "Safety backup available at: $SAFETY_BACKUP"
        start_application
        exit 1
    fi
    
    # Start application
    start_application
    
    # Show summary
    show_restore_summary "$SAFETY_BACKUP"
    
    log_success "Restore script completed successfully"
    exit 0
}

# Run main function
main "$@"
