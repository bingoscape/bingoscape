#!/bin/bash
set -e

# =============================================================================
# Setup Automated Backup Cron Jobs for Bingoscape
# =============================================================================
# Installs cron jobs for automated database backups
# Run this once on the server to setup automated backups
# Usage: ./setup-backup-cron.sh
# =============================================================================

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_SCRIPT="$SCRIPT_DIR/backup-db.sh"
VERIFY_SCRIPT="$SCRIPT_DIR/verify-backup.sh"
LOG_FILE="$APP_DIR/backups/backup.log"
VERIFY_LOG_FILE="$APP_DIR/backups/verification.log"

# User running the cron jobs (usually current user)
CRON_USER=$(whoami)

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo "[INFO] $*"
}

log_success() {
    echo "[SUCCESS] ✅ $*"
}

log_error() {
    echo "[ERROR] ❌ $*"
}

log_warning() {
    echo "[WARNING] ⚠️  $*"
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if cron is installed
    if ! command -v crontab &> /dev/null; then
        log_error "cron/crontab is not installed"
        log_error "Install with: sudo apt-get install cron"
        exit 1
    fi
    
    # Check if backup script exists
    if [ ! -f "$BACKUP_SCRIPT" ]; then
        log_error "Backup script not found: $BACKUP_SCRIPT"
        exit 1
    fi
    
    # Check if verify script exists
    if [ ! -f "$VERIFY_SCRIPT" ]; then
        log_error "Verify script not found: $VERIFY_SCRIPT"
        exit 1
    fi
    
    # Make scripts executable
    chmod +x "$BACKUP_SCRIPT" 2>/dev/null || true
    chmod +x "$VERIFY_SCRIPT" 2>/dev/null || true
    
    log_success "Prerequisites check passed"
}

create_backup_directories() {
    log_info "Creating backup directories..."
    
    mkdir -p "$APP_DIR/backups/daily"
    mkdir -p "$APP_DIR/backups/weekly"
    mkdir -p "$APP_DIR/backups/monthly"
    mkdir -p "$APP_DIR/backups/pre-deploy"
    mkdir -p "$APP_DIR/backups/pre-restore"
    
    # Set proper permissions
    chmod -R 750 "$APP_DIR/backups" 2>/dev/null || true
    
    # Create log files
    touch "$LOG_FILE"
    touch "$VERIFY_LOG_FILE"
    
    log_success "Backup directories created"
}

show_cron_schedule() {
    cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📅 Proposed Backup Schedule
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Daily Backups:
  Schedule: Every day at 3:00 AM
  Retention: Keep last 7 backups
  Cron: 0 3 * * *

Weekly Backups:
  Schedule: Every Sunday at 2:00 AM
  Retention: Keep last 4 backups (1 month)
  Cron: 0 2 * * 0

Monthly Backups:
  Schedule: First day of each month at 1:00 AM
  Retention: Keep last 6 backups (6 months)
  Cron: 0 1 1 * *

Backup Verification:
  Schedule: First Sunday of month at 5:00 AM
  Purpose: Verify backups are restorable
  Cron: 0 5 1-7 * 0

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

All times are in server local time ($(date +%Z))
Logs will be written to: $LOG_FILE

EOF
}

backup_existing_crontab() {
    log_info "Backing up existing crontab..."
    
    local backup_file="$APP_DIR/backups/crontab.backup.$(date +%Y%m%d_%H%M%S)"
    
    if crontab -l &>/dev/null; then
        crontab -l > "$backup_file"
        log_success "Existing crontab backed up to: $backup_file"
    else
        log_info "No existing crontab found"
    fi
}

install_cron_jobs() {
    log_info "Installing cron jobs..."
    
    # Get existing crontab (or empty if none exists)
    local temp_crontab=$(mktemp)
    crontab -l 2>/dev/null > "$temp_crontab" || true
    
    # Remove any existing Bingoscape backup entries
    sed -i '/# Bingoscape Database Backups/,/# End Bingoscape Database Backups/d' "$temp_crontab" 2>/dev/null || true
    
    # Add new cron jobs
    cat >> "$temp_crontab" <<EOF

# Bingoscape Database Backups - Auto-generated on $(date)
# Daily backup at 3:00 AM
0 3 * * * $BACKUP_SCRIPT daily >> $LOG_FILE 2>&1

# Weekly backup at 2:00 AM on Sunday
0 2 * * 0 $BACKUP_SCRIPT weekly >> $LOG_FILE 2>&1

# Monthly backup at 1:00 AM on the 1st
0 1 1 * * $BACKUP_SCRIPT monthly >> $LOG_FILE 2>&1

# Verify backups at 5:00 AM on first Sunday of month (days 1-7, Sunday)
0 5 1-7 * 0 [ \$(date +\%u) -eq 7 ] && $VERIFY_SCRIPT >> $VERIFY_LOG_FILE 2>&1
# End Bingoscape Database Backups

EOF
    
    # Install new crontab
    crontab "$temp_crontab"
    rm "$temp_crontab"
    
    log_success "Cron jobs installed successfully"
}

verify_cron_installation() {
    log_info "Verifying cron installation..."
    
    echo ""
    echo "Current crontab for user '$CRON_USER':"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    crontab -l | grep -A 10 "Bingoscape Database Backups" || log_error "Cron jobs not found in crontab"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    log_success "Cron installation verified"
}

test_backup_script() {
    log_info "Testing backup script (dry run)..."
    
    echo ""
    read -p "Would you like to run a test backup now? (yes/no): " -r
    echo ""
    
    if [ "$REPLY" = "yes" ]; then
        log_info "Running test backup..."
        "$BACKUP_SCRIPT" daily
        
        if [ $? -eq 0 ]; then
            log_success "Test backup completed successfully"
        else
            log_error "Test backup failed"
            log_warning "Please check the backup script and try again"
        fi
    else
        log_info "Skipping test backup"
    fi
}

show_next_steps() {
    cat <<EOF

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ BACKUP AUTOMATION SETUP COMPLETE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Automated backups are now configured!

Next Steps:

1. Monitor backup logs:
   tail -f $LOG_FILE

2. Check verification logs:
   tail -f $VERIFY_LOG_FILE

3. View backup files:
   ls -lh $APP_DIR/backups/daily/
   ls -lh $APP_DIR/backups/weekly/
   ls -lh $APP_DIR/backups/monthly/

4. Manually run a backup:
   $BACKUP_SCRIPT daily
   $BACKUP_SCRIPT weekly
   $BACKUP_SCRIPT monthly

5. Manually restore a backup:
   $SCRIPT_DIR/restore-db.sh <backup-file>

6. Manually verify a backup:
   $VERIFY_SCRIPT <backup-file>

7. Optional: Configure Discord notifications
   Add to your .env file:
   BACKUP_ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/...

8. View cron jobs:
   crontab -l

9. Edit cron jobs:
   crontab -e

10. Remove cron jobs (if needed):
    crontab -e
    # Delete the "Bingoscape Database Backups" section

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Important Notes:
- First daily backup will run tomorrow at 3:00 AM
- First weekly backup will run next Sunday at 2:00 AM
- First monthly backup will run on the 1st at 1:00 AM
- First verification will run on first Sunday of next month at 5:00 AM

- All times are in server timezone: $(date +%Z)
- Check logs regularly to ensure backups are completing successfully
- Test restore process quarterly to ensure backups are valid

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "⚙️  Bingoscape Backup Automation Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    log_info "Setting up automated database backups..."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup directories
    create_backup_directories
    
    # Show proposed schedule
    show_cron_schedule
    
    # Confirm installation
    read -p "Install these cron jobs? (yes/no): " -r
    echo ""
    
    if [ "$REPLY" != "yes" ]; then
        log_warning "Installation cancelled"
        exit 0
    fi
    
    # Backup existing crontab
    backup_existing_crontab
    
    # Install cron jobs
    install_cron_jobs
    
    # Verify installation
    verify_cron_installation
    
    # Test backup script
    test_backup_script
    
    # Show next steps
    show_next_steps
    
    log_success "Setup completed successfully!"
    exit 0
}

# Run main function
main "$@"
