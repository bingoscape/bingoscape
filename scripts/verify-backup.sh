#!/bin/bash
set -e

# =============================================================================
# PostgreSQL Backup Verification Script for Bingoscape
# =============================================================================
# Validates backups by restoring them to a temporary database
# Runs monthly via cron to ensure backups are restorable
# Usage: ./verify-backup.sh [backup-file]
# =============================================================================

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Test database configuration
TEST_DB_NAME="bingoscape_verify_test"
DB_USER="${DB_USER:-bingoscapenext}"
CONTAINER_NAME="bingoscape-postgres"
TEST_CONTAINER_NAME="bingoscape-verify-test"

# Discord webhook (optional)
DISCORD_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"

# Backup file to verify (from command line or auto-select most recent)
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

send_discord_notification() {
    local message="$1"
    local is_error="${2:-false}"
    
    if [ -z "$DISCORD_WEBHOOK_URL" ]; then
        return 0
    fi
    
    local color="3066993"  # Blue
    if [ "$is_error" = "true" ]; then
        color="15158332"  # Red
    fi
    
    local json_payload=$(cat <<EOF
{
  "embeds": [{
    "title": "Bingoscape Backup Verification",
    "description": "$message",
    "color": $color,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  }]
}
EOF
)
    
    curl -X POST -H "Content-Type: application/json" -d "$json_payload" "$DISCORD_WEBHOOK_URL" &>/dev/null || true
}

select_backup_file() {
    if [ -n "$BACKUP_FILE" ]; then
        log_info "Using specified backup file: $BACKUP_FILE"
        return 0
    fi
    
    log_info "No backup file specified, selecting most recent daily backup..."
    
    # Find most recent daily backup
    BACKUP_FILE=$(find "$BACKUP_BASE_DIR/daily" -name "*.sql.gz" -type f -printf '%T@ %p\n' 2>/dev/null | \
        sort -rn | head -1 | cut -d' ' -f2-)
    
    if [ -z "$BACKUP_FILE" ]; then
        log_error "No backup files found in $BACKUP_BASE_DIR/daily"
        exit 1
    fi
    
    log_info "Selected backup: $BACKUP_FILE"
}

validate_backup_file() {
    log_info "Validating backup file..."
    
    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file does not exist: $BACKUP_FILE"
        exit 1
    fi
    
    # Test gzip integrity
    if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        send_discord_notification "❌ Backup verification failed: File corrupted\n$BACKUP_FILE" "true"
        exit 1
    fi
    
    local file_size=$(du -h "$BACKUP_FILE" | cut -f1)
    log_success "Backup file validated (size: $file_size)"
}

create_test_container() {
    log_info "Creating temporary PostgreSQL container for testing..."
    
    # Clean up any existing test container
    cleanup_test_container 2>/dev/null || true
    
    # Start temporary PostgreSQL container
    docker run -d \
        --name "$TEST_CONTAINER_NAME" \
        --network bingoscape_bingoscape-network \
        -e POSTGRES_USER="$DB_USER" \
        -e POSTGRES_PASSWORD="test_password" \
        -e POSTGRES_DB="$TEST_DB_NAME" \
        postgres:18-alpine \
        >/dev/null
    
    # Wait for container to be ready
    log_info "Waiting for test database to be ready..."
    local retries=0
    local max_retries=30
    
    while [ $retries -lt $max_retries ]; do
        if docker exec "$TEST_CONTAINER_NAME" pg_isready -U "$DB_USER" &>/dev/null; then
            log_success "Test container is ready"
            return 0
        fi
        retries=$((retries + 1))
        sleep 1
    done
    
    log_error "Test container failed to start"
    cleanup_test_container
    exit 1
}

restore_to_test_container() {
    log_info "Restoring backup to test database..."
    
    if gunzip -c "$BACKUP_FILE" | docker exec -i "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" &>/dev/null; then
        log_success "Backup restored to test database"
        return 0
    else
        log_error "Failed to restore backup to test database"
        return 1
    fi
}

verify_restored_data() {
    log_info "Verifying restored data..."
    
    # Test 1: Check if database is accessible
    if ! docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -c "SELECT 1" &>/dev/null; then
        log_error "Test database is not accessible"
        return 1
    fi
    log_success "✓ Database connection test passed"
    
    # Test 2: Count tables
    local table_count=$(docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'bingoscape-next_%'" 2>/dev/null | tr -d ' ')
    
    if [ -z "$table_count" ] || [ "$table_count" -eq 0 ]; then
        log_error "No tables found in restored database"
        return 1
    fi
    log_success "✓ Table count test passed ($table_count tables found)"
    
    # Test 3: Verify key tables exist
    local required_tables=("bingoscape-next_user" "bingoscape-next_events" "bingoscape-next_bingos" "bingoscape-next_tiles")
    for table in "${required_tables[@]}"; do
        local exists=$(docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = '$table')" 2>/dev/null | tr -d ' ')
        
        if [ "$exists" != "t" ]; then
            log_error "Required table missing: $table"
            return 1
        fi
    done
    log_success "✓ Required tables test passed"
    
    # Test 4: Check record counts
    local user_count=$(docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
        "SELECT COUNT(*) FROM \"bingoscape-next_user\"" 2>/dev/null | tr -d ' ')
    
    local event_count=$(docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
        "SELECT COUNT(*) FROM \"bingoscape-next_events\"" 2>/dev/null | tr -d ' ')
    
    log_info "Record counts: $user_count users, $event_count events"
    
    if [ "$user_count" -eq 0 ] && [ "$event_count" -eq 0 ]; then
        log_error "Database appears to be empty"
        return 1
    fi
    log_success "✓ Record count test passed"
    
    # Test 5: Test foreign key relationships
    local fk_count=$(docker exec "$TEST_CONTAINER_NAME" psql -U "$DB_USER" -d "$TEST_DB_NAME" -t -c \
        "SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_type = 'FOREIGN KEY'" 2>/dev/null | tr -d ' ')
    
    if [ -z "$fk_count" ] || [ "$fk_count" -eq 0 ]; then
        log_error "No foreign key constraints found"
        return 1
    fi
    log_success "✓ Foreign key relationship test passed ($fk_count constraints)"
    
    log_success "All verification tests passed"
    return 0
}

cleanup_test_container() {
    log_info "Cleaning up test container..."
    
    docker stop "$TEST_CONTAINER_NAME" &>/dev/null || true
    docker rm "$TEST_CONTAINER_NAME" &>/dev/null || true
    
    log_info "Cleanup completed"
}

show_verification_summary() {
    local result="$1"
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    if [ "$result" = "success" ]; then
        echo "✅ BACKUP VERIFICATION SUCCESSFUL"
    else
        echo "❌ BACKUP VERIFICATION FAILED"
    fi
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Verification Details:"
    echo "  Backup:   $BACKUP_FILE"
    echo "  Size:     $(du -h "$BACKUP_FILE" | cut -f1)"
    echo "  Time:     $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    if [ "$result" = "success" ]; then
        echo "Result:   ✅ Backup is valid and restorable"
        echo ""
        echo "All verification tests passed:"
        echo "  ✓ Database connection test"
        echo "  ✓ Table structure test"
        echo "  ✓ Required tables test"
        echo "  ✓ Record count test"
        echo "  ✓ Foreign key relationship test"
    else
        echo "Result:   ❌ Backup verification failed"
        echo ""
        echo "Action:   Review logs above for failure details"
        echo "          Create a new backup immediately"
    fi
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "🔍 Bingoscape Backup Verification Script"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log_info "Starting at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Select backup file
    select_backup_file
    
    # Validate backup file
    validate_backup_file
    
    # Create test container
    if ! create_test_container; then
        send_discord_notification "❌ Backup verification failed: Could not create test container" "true"
        exit 1
    fi
    
    # Restore to test container
    if ! restore_to_test_container; then
        log_error "Backup restoration failed"
        cleanup_test_container
        send_discord_notification "❌ Backup verification failed: Could not restore backup\n$BACKUP_FILE" "true"
        show_verification_summary "failed"
        exit 1
    fi
    
    # Verify restored data
    if ! verify_restored_data; then
        log_error "Data verification failed"
        cleanup_test_container
        send_discord_notification "❌ Backup verification failed: Data validation failed\n$BACKUP_FILE" "true"
        show_verification_summary "failed"
        exit 1
    fi
    
    # Cleanup
    cleanup_test_container
    
    # Show summary
    show_verification_summary "success"
    
    # Send success notification
    send_discord_notification "✅ Backup verification successful\nBackup: $(basename "$BACKUP_FILE")\nSize: $(du -h "$BACKUP_FILE" | cut -f1)" "false"
    
    log_success "Verification script completed successfully"
    exit 0
}

# Run main function
main "$@"
