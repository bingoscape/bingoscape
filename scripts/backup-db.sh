#!/bin/bash
set -e

# =============================================================================
# PostgreSQL Database Backup Script for Bingoscape
# =============================================================================
# Creates compressed SQL backups with retention policy management
# Supports: daily, weekly, monthly, and pre-deploy backups
# Usage: ./backup-db.sh [type] [git-sha]
# =============================================================================

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_BASE_DIR="$APP_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_ONLY=$(date +%Y-%m-%d)
MONTH_ONLY=$(date +%Y-%m)

# Database credentials (from .env or defaults)
DB_NAME="${DB_NAME:-bingoscapenext}"
DB_USER="${DB_USER:-bingoscapenext}"
CONTAINER_NAME="bingoscape-postgres"

# Discord webhook (optional - set in .env)
DISCORD_WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-}"

# Backup type (daily, weekly, monthly, pre-deploy)
BACKUP_TYPE="${1:-daily}"
GIT_SHA="${2:-}"

# Retention policies (number of backups to keep)
RETENTION_DAILY=7
RETENTION_WEEKLY=4
RETENTION_MONTHLY=6
RETENTION_PRE_DEPLOY=10

# Minimum backup size (KB) - backups smaller than this are considered failed
MIN_BACKUP_SIZE_KB=100

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
    "title": "Bingoscape Database Backup",
    "description": "$message",
    "color": $color,
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "footer": {
      "text": "Backup Type: $BACKUP_TYPE"
    }
  }]
}
EOF
)
    
    curl -X POST -H "Content-Type: application/json" -d "$json_payload" "$DISCORD_WEBHOOK_URL" &>/dev/null || true
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if Docker is available
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install Docker."
        exit 1
    fi
    
    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
        log_error "PostgreSQL container '$CONTAINER_NAME' is not running."
        log_error "Start it with: docker compose up -d postgres"
        exit 1
    fi
    
    log_info "Prerequisites check passed"
}

validate_backup_type() {
    case "$BACKUP_TYPE" in
        daily|weekly|monthly|pre-deploy)
            log_info "Backup type: $BACKUP_TYPE"
            ;;
        *)
            log_error "Invalid backup type: $BACKUP_TYPE"
            log_error "Valid types: daily, weekly, monthly, pre-deploy"
            exit 1
            ;;
    esac
}

create_backup_directories() {
    log_info "Creating backup directories..."
    
    mkdir -p "$BACKUP_BASE_DIR/daily"
    mkdir -p "$BACKUP_BASE_DIR/weekly"
    mkdir -p "$BACKUP_BASE_DIR/monthly"
    mkdir -p "$BACKUP_BASE_DIR/pre-deploy"
    
    # Set proper permissions
    chmod -R 750 "$BACKUP_BASE_DIR" 2>/dev/null || true
    
    log_info "Backup directories ready"
}

generate_backup_filename() {
    local backup_dir=""
    local filename=""
    
    case "$BACKUP_TYPE" in
        daily)
            backup_dir="$BACKUP_BASE_DIR/daily"
            filename="daily-${DATE_ONLY}.sql.gz"
            ;;
        weekly)
            backup_dir="$BACKUP_BASE_DIR/weekly"
            filename="weekly-${DATE_ONLY}.sql.gz"
            ;;
        monthly)
            backup_dir="$BACKUP_BASE_DIR/monthly"
            filename="monthly-${MONTH_ONLY}.sql.gz"
            ;;
        pre-deploy)
            backup_dir="$BACKUP_BASE_DIR/pre-deploy"
            if [ -n "$GIT_SHA" ]; then
                filename="pre-deploy-${TIMESTAMP}-${GIT_SHA}.sql.gz"
            else
                filename="pre-deploy-${TIMESTAMP}.sql.gz"
            fi
            ;;
    esac
    
    echo "${backup_dir}/${filename}"
}

create_backup() {
    local backup_file="$1"
    
    log_info "Starting backup to: $backup_file"
    log_info "Database: $DB_NAME"
    log_info "User: $DB_USER"
    
    # Create SQL dump using docker exec
    # --clean: Add DROP statements before CREATE
    # --if-exists: Use IF EXISTS with DROP statements
    # --no-owner: Don't output commands to set ownership
    # --no-privileges: Don't output commands to set privileges
    if docker exec "$CONTAINER_NAME" pg_dump \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --clean \
        --if-exists \
        --no-owner \
        --no-privileges \
        2>/dev/null | gzip > "$backup_file"; then
        
        log_success "Backup created successfully"
        return 0
    else
        log_error "Backup creation failed"
        return 1
    fi
}

validate_backup() {
    local backup_file="$1"
    
    log_info "Validating backup file..."
    
    # Check if file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file does not exist: $backup_file"
        return 1
    fi
    
    # Check file size (in KB)
    local file_size_kb=$(du -k "$backup_file" | cut -f1)
    
    if [ "$file_size_kb" -lt "$MIN_BACKUP_SIZE_KB" ]; then
        log_error "Backup file is too small: ${file_size_kb}KB (minimum: ${MIN_BACKUP_SIZE_KB}KB)"
        log_error "This likely indicates a backup failure"
        return 1
    fi
    
    # Test gzip integrity
    if ! gzip -t "$backup_file" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        return 1
    fi
    
    local file_size_human=$(du -h "$backup_file" | cut -f1)
    log_success "Backup validation passed (size: $file_size_human)"
    return 0
}

cleanup_old_backups() {
    local backup_dir=""
    local retention=0
    
    case "$BACKUP_TYPE" in
        daily)
            backup_dir="$BACKUP_BASE_DIR/daily"
            retention=$RETENTION_DAILY
            ;;
        weekly)
            backup_dir="$BACKUP_BASE_DIR/weekly"
            retention=$RETENTION_WEEKLY
            ;;
        monthly)
            backup_dir="$BACKUP_BASE_DIR/monthly"
            retention=$RETENTION_MONTHLY
            ;;
        pre-deploy)
            backup_dir="$BACKUP_BASE_DIR/pre-deploy"
            retention=$RETENTION_PRE_DEPLOY
            ;;
    esac
    
    log_info "Applying retention policy (keep last $retention backups)..."
    
    # Count current backups
    local backup_count=$(find "$backup_dir" -name "*.sql.gz" -type f | wc -l)
    
    if [ "$backup_count" -le "$retention" ]; then
        log_info "Current backups: $backup_count (within retention limit)"
        return 0
    fi
    
    # Delete old backups (keep only the most recent N)
    local to_delete=$((backup_count - retention))
    log_info "Deleting $to_delete old backup(s)..."
    
    find "$backup_dir" -name "*.sql.gz" -type f -printf '%T+ %p\n' | \
        sort | \
        head -n "$to_delete" | \
        cut -d' ' -f2- | \
        while read -r old_backup; do
            log_info "Deleting: $(basename "$old_backup")"
            rm -f "$old_backup"
        done
    
    log_info "Cleanup completed"
}

show_backup_summary() {
    local backup_file="$1"
    local file_size=$(du -h "$backup_file" | cut -f1)
    
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "✅ BACKUP COMPLETED SUCCESSFULLY"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Backup Details:"
    echo "  Type:     $BACKUP_TYPE"
    echo "  File:     $backup_file"
    echo "  Size:     $file_size"
    echo "  Database: $DB_NAME"
    echo "  Time:     $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Show retention status
    local backup_dir=$(dirname "$backup_file")
    local backup_count=$(find "$backup_dir" -name "*.sql.gz" -type f | wc -l)
    echo "  Total $BACKUP_TYPE backups: $backup_count"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    log_info "========================================"
    log_info "Bingoscape Database Backup Script"
    log_info "========================================"
    log_info "Starting at: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Validate backup type
    validate_backup_type
    
    # Create backup directories
    create_backup_directories
    
    # Generate backup filename
    BACKUP_FILE=$(generate_backup_filename)
    
    # Create backup
    if ! create_backup "$BACKUP_FILE"; then
        log_error "Backup failed!"
        send_discord_notification "❌ Backup failed for type: $BACKUP_TYPE" "true"
        exit 1
    fi
    
    # Validate backup
    if ! validate_backup "$BACKUP_FILE"; then
        log_error "Backup validation failed!"
        rm -f "$BACKUP_FILE"  # Remove invalid backup
        send_discord_notification "❌ Backup validation failed for type: $BACKUP_TYPE" "true"
        exit 1
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Show summary
    show_backup_summary "$BACKUP_FILE"
    
    # Send success notification
    local file_size=$(du -h "$BACKUP_FILE" | cut -f1)
    send_discord_notification "✅ Backup completed successfully\nType: $BACKUP_TYPE\nSize: $file_size\nFile: $(basename "$BACKUP_FILE")" "false"
    
    log_success "Backup script completed successfully"
    exit 0
}

# Run main function
main "$@"
