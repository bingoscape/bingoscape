#!/bin/bash
set -e

# Installs the daily RBAC reconciliation cron job (see rbac-reconcile.sh).
# Idempotent: replaces its own block in the crontab. Run once on the server.
# Usage: ./scripts/setup-rbac-reconcile-cron.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
RECONCILE_SCRIPT="$SCRIPT_DIR/rbac-reconcile.sh"
LOG_FILE="$APP_DIR/backups/rbac-reconcile.log"

if ! command -v crontab &> /dev/null; then
    echo "[ERROR] crontab is not installed (sudo apt-get install cron)"
    exit 1
fi

chmod +x "$RECONCILE_SCRIPT"
mkdir -p "$APP_DIR/backups"
touch "$LOG_FILE"

TEMP_CRONTAB=$(mktemp)
crontab -l 2>/dev/null > "$TEMP_CRONTAB" || true
sed -i '/# Bingoscape RBAC Reconciliation/,/# End Bingoscape RBAC Reconciliation/d' "$TEMP_CRONTAB"
cat >> "$TEMP_CRONTAB" <<CRON
# Bingoscape RBAC Reconciliation - installed $(date)
# Daily at 4:00 AM, after the 3:00 AM backup
0 4 * * * $RECONCILE_SCRIPT >> $LOG_FILE 2>&1
# End Bingoscape RBAC Reconciliation
CRON
crontab "$TEMP_CRONTAB"
rm -f "$TEMP_CRONTAB"

echo "[SUCCESS] Daily RBAC reconciliation installed (4:00 AM). Log: $LOG_FILE"
echo "Run it once now to check the setup: $RECONCILE_SCRIPT"
