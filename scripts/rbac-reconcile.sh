#!/bin/bash
set -uo pipefail

# =============================================================================
# Daily RBAC reconciliation (epic #183, RBAC 3/8)
# =============================================================================
# Calls the app's /api/cron/rbac-reconcile route, which runs the membership
# verification queries (duplicates, Events/Clans without an admin, owner not an
# admin, role-ledger drift, missing indexes). Exit 0 = clean; exit 1 = findings
# or the job could not run; the result is appended to backups/rbac-reconcile.log
# and, when BACKUP_ALERT_WEBHOOK_URL is set in .env, posted to Discord.
#
# Needs CRON_SECRET in the server .env (the same secret as /api/cron/unlock).
# Install the daily cron entry with ./scripts/setup-rbac-reconcile-cron.sh.
# Usage: ./scripts/rbac-reconcile.sh
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$APP_DIR/.env"
LOG_FILE="$APP_DIR/backups/rbac-reconcile.log"
URL="${RBAC_RECONCILE_URL:-http://127.0.0.1:3000/api/cron/rbac-reconcile}"

# Read single values without sourcing the whole .env.
env_value() {
    [ -f "$ENV_FILE" ] || return 0
    grep -E "^$1=" "$ENV_FILE" | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//"
}

CRON_SECRET="${CRON_SECRET:-$(env_value CRON_SECRET)}"
WEBHOOK_URL="${BACKUP_ALERT_WEBHOOK_URL:-$(env_value BACKUP_ALERT_WEBHOOK_URL)}"

mkdir -p "$(dirname "$LOG_FILE")"
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"; echo "$*"; }

alert() {
    [ -z "$WEBHOOK_URL" ] && return 0
    # Keep Discord's 2000 character limit and strip characters that break the JSON.
    local text
    text=$(printf '%s' "$1" | tr -d '"\\\n\r' | cut -c1-1500)
    curl -s -X POST -H "Content-Type: application/json" \
        -d "{\"embeds\":[{\"title\":\"Bingoscape RBAC reconciliation\",\"description\":\"$text\",\"color\":15158332}]}" \
        "$WEBHOOK_URL" > /dev/null || true
}

if [ -z "$CRON_SECRET" ]; then
    log "ERROR: CRON_SECRET is not set; cannot call $URL"
    alert "RBAC reconciliation could not run: CRON_SECRET is not set on the server."
    exit 1
fi

BODY_FILE=$(mktemp)
trap 'rm -f "$BODY_FILE"' EXIT
STATUS=$(curl -s -o "$BODY_FILE" -w '%{http_code}' --max-time 60 \
    -H "Authorization: Bearer $CRON_SECRET" "$URL") || true
STATUS="${STATUS:-000}"
BODY=$(cat "$BODY_FILE")

if [ "$STATUS" = "200" ]; then
    log "OK: RBAC reconciliation clean"
    exit 0
fi

log "FAILED (HTTP $STATUS): $BODY"
alert "RBAC reconciliation failed (HTTP $STATUS). Findings: $BODY"
exit 1
