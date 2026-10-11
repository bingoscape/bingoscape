#!/usr/bin/env bash
# =============================================================================
# Bingoscape server-side deploy
# =============================================================================
# Run on the production server by .github/workflows/deploy.yml (over SSH), after
# the workflow has uploaded docker-compose.yml, scripts/ and a freshly rendered
# env file to STAGE_DIR. Can also be run by hand for a manual deploy/rollback.
#
# Flow:
#   1. install compose file, scripts and .env (previous .env is kept as backup)
#   2. pull the app + migrator images for IMAGE_TAG, then log out of the registry
#   3. pre-deploy database backup (skipped if postgres is not running yet)
#   4. run migrations with the migrator image (a failure stops the deploy; the
#      running app is not touched)
#   5. replace only the app container, wait until it is healthy
#   6. record the tag in .deployed-tag
# If anything fails after step 5 started, the previous app image is restored.
# Note: a rollback restores the app only. Migrations are NOT reverted, so a
# migration must stay compatible with the previous app version.
#
# Environment:
#   IMAGE_TAG           required  image tag to deploy (main, sha-<short>, v1.2.3)
#   REGISTRY_USER       required* GHCR user      (* unless SKIP_REGISTRY_LOGIN=1)
#   REGISTRY_TOKEN      required* GHCR token
#   REGISTRY            optional  default ghcr.io
#   APP_DIR             optional  default $HOME/bingoscape
#   STAGE_DIR           optional  default /tmp/bingoscape-deploy
#   HEALTH_URL          optional  default http://127.0.0.1:3000/api/uptime
#   HEALTH_TIMEOUT      optional  seconds, default 120
#   SKIP_REGISTRY_LOGIN optional  set to 1 to skip docker login/logout
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/bingoscape}"
STAGE_DIR="${STAGE_DIR:-/tmp/bingoscape-deploy}"
REGISTRY="${REGISTRY:-ghcr.io}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/uptime}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-120}"
SKIP_REGISTRY_LOGIN="${SKIP_REGISTRY_LOGIN:-0}"
TAG_PATTERN='^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$'
ENV_BACKUPS_TO_KEEP=5

SWAPPED=0
LOGGED_IN=0
PREV_TAG=""
PREV_IMAGE_ID=""
PREV_REPO=""

log() { printf '[deploy %s] %s\n' "$(date -u +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

dc() { docker compose "$@"; }

# Set or replace NAME=value in .env. Only used for IMAGE_TAG, whose value is
# restricted to TAG_PATTERN, so no quoting is needed.
set_env_var() {
    local name="$1" value="$2" tmp
    tmp="$(mktemp "$APP_DIR/.env.tmp.XXXXXX")"
    { grep -v "^${name}=" "$APP_DIR/.env" || true; printf '%s=%s\n' "$name" "$value"; } > "$tmp"
    chmod 600 "$tmp"
    mv "$tmp" "$APP_DIR/.env"
}

registry_login() {
    if [ "$SKIP_REGISTRY_LOGIN" = "1" ]; then
        return 0
    fi
    printf '%s' "$REGISTRY_TOKEN" | docker login "$REGISTRY" -u "$REGISTRY_USER" --password-stdin > /dev/null
    LOGGED_IN=1
}

registry_logout() {
    if [ "$LOGGED_IN" = "1" ]; then
        docker logout "$REGISTRY" > /dev/null 2>&1 || true
        LOGGED_IN=0
    fi
}

http_ok() {
    if command -v curl > /dev/null 2>&1; then
        curl -fsS --max-time 5 -o /dev/null "$1"
    else
        wget -q -T 5 -O /dev/null "$1"
    fi
}

# Poll HEALTH_URL until it answers 2xx. Returns non-zero on timeout.
wait_for_health() {
    local deadline=$((SECONDS + HEALTH_TIMEOUT))
    log "Waiting up to ${HEALTH_TIMEOUT}s for ${HEALTH_URL}"
    while [ "$SECONDS" -lt "$deadline" ]; do
        if http_ok "$HEALTH_URL" 2> /dev/null; then
            log "Application is healthy"
            return 0
        fi
        sleep 2
    done
    log "Health check timed out after ${HEALTH_TIMEOUT}s"
    return 1
}

# Restore the app container that was running before this deploy started.
# Uses the local image ID captured before the pull, so it also works when the
# previous tag is mutable (e.g. "main" was overwritten by the pull).
# Runs from the EXIT trap, so errors are handled explicitly, not via set -e.
rollback() {
    if [ -z "$PREV_IMAGE_ID" ]; then
        log "There was no previous app container, nothing to roll back to"
        return 2
    fi
    if ! docker image inspect "$PREV_IMAGE_ID" > /dev/null 2>&1; then
        log "The previous app image ($PREV_IMAGE_ID) is no longer available locally"
        return 1
    fi

    local rtag="${PREV_TAG:-rollback}"
    log "Rolling back app to ${rtag} (${PREV_IMAGE_ID})"
    docker tag "$PREV_IMAGE_ID" "${PREV_REPO}:${rtag}" || return 1
    export IMAGE_TAG="$rtag"
    set_env_var IMAGE_TAG "$rtag" || return 1
    dc up -d --no-deps --wait --wait-timeout 180 --pull never app || return 1
    wait_for_health || return 1
    log "Rollback complete, running ${rtag}"
}

on_exit() {
    local rc=$?
    trap - EXIT
    set +e
    registry_logout

    if [ "$rc" -ne 0 ]; then
        log "DEPLOY FAILED (exit code ${rc})"
        if [ "$SWAPPED" = "1" ]; then
            log "Logs of the new app container:"
            dc logs --tail=80 app 2>&1
            rollback
            case $? in
                0) log "The previous version is running again. The failed tag was NOT deployed." ;;
                2) log "No previous version to restore. The failed container was left in place for inspection." ;;
                *) log "ROLLBACK FAILED. Manual intervention required (see 'docker compose ps' and 'docker compose logs app')." ;;
            esac
        else
            log "The deploy failed before the app was replaced; the running app was not touched."
        fi
    fi

    # Never leave the rendered secrets lying around in the staging directory
    if [ "$STAGE_DIR" != "$APP_DIR" ] && [ -f "$STAGE_DIR/docker-compose.yml" ]; then
        rm -rf "$STAGE_DIR"
    fi
    exit "$rc"
}
trap on_exit EXIT
trap 'exit 130' INT TERM HUP

# --- 0. validate input --------------------------------------------------------
[[ "${IMAGE_TAG:-}" =~ $TAG_PATTERN ]] || die "IMAGE_TAG is missing or invalid (allowed: letters, digits, '_', '.', '-')"
export IMAGE_TAG
if [ "$SKIP_REGISTRY_LOGIN" != "1" ]; then
    [ -n "${REGISTRY_USER:-}" ] && [ -n "${REGISTRY_TOKEN:-}" ] || die "REGISTRY_USER and REGISTRY_TOKEN are required"
fi
command -v docker > /dev/null 2>&1 || die "docker not found"
log "Deploying image tag: ${IMAGE_TAG}"

# --- 1. install files ---------------------------------------------------------
mkdir -p "$APP_DIR/uploads"
# UID 1001 is the nextjs user inside the container. Directory only, not recursive.
sudo -n chown 1001:1001 "$APP_DIR/uploads" 2> /dev/null || chown 1001:1001 "$APP_DIR/uploads" 2> /dev/null || true
sudo -n chmod 775 "$APP_DIR/uploads" 2> /dev/null || chmod 775 "$APP_DIR/uploads" 2> /dev/null || true

# The rendered .env does not carry IMAGE_TAG. Keep the one of the running
# deployment until the new app has really been started.
OLD_ENV_TAG=""
if [ -f "$APP_DIR/.env" ]; then
    OLD_ENV_TAG="$(grep -E '^IMAGE_TAG=' "$APP_DIR/.env" | tail -n 1 | cut -d= -f2- || true)"
fi

if [ "$STAGE_DIR" != "$APP_DIR" ]; then
    [ -f "$STAGE_DIR/docker-compose.yml" ] || die "$STAGE_DIR/docker-compose.yml not found"
    install -m 644 "$STAGE_DIR/docker-compose.yml" "$APP_DIR/docker-compose.yml"
    if [ -d "$STAGE_DIR/scripts" ]; then
        mkdir -p "$APP_DIR/scripts"
        cp -R "$STAGE_DIR/scripts/." "$APP_DIR/scripts/"
        chmod +x "$APP_DIR"/scripts/*.sh
    fi
    if [ -f "$STAGE_DIR/deploy.env" ]; then
        if [ -f "$APP_DIR/.env" ]; then
            cp -p "$APP_DIR/.env" "$APP_DIR/.env.backup.$(date +%Y%m%d_%H%M%S)"
        fi
        install -m 600 "$STAGE_DIR/deploy.env" "$APP_DIR/.env"
    fi
fi
cd "$APP_DIR"
[ -f .env ] || die "$APP_DIR/.env not found"
chmod 600 .env
if [[ "$OLD_ENV_TAG" =~ $TAG_PATTERN ]]; then
    set_env_var IMAGE_TAG "$OLD_ENV_TAG"
fi
# Keep the newest few .env backups (they contain secrets)
# shellcheck disable=SC2012 # names are generated by this script, no odd characters
ls -1t .env.backup.* 2> /dev/null | tail -n +$((ENV_BACKUPS_TO_KEEP + 1)) | xargs -r rm -f -- || true

# --- 2. remember what is running now ------------------------------------------
if [ -s .deployed-tag ]; then
    PREV_TAG="$(head -n 1 .deployed-tag)"
    [[ "$PREV_TAG" =~ $TAG_PATTERN ]] || PREV_TAG=""
fi
# Only a container that is actually running counts as "the previous version"
PREV_CONTAINER="$(dc ps -q --status running app 2> /dev/null | head -n 1 || true)"
if [ -n "$PREV_CONTAINER" ]; then
    PREV_IMAGE_ID="$(docker inspect -f '{{.Image}}' "$PREV_CONTAINER" 2> /dev/null || true)"
    PREV_REF="$(docker inspect -f '{{.Config.Image}}' "$PREV_CONTAINER" 2> /dev/null || true)"
    PREV_REPO="${PREV_REF%:*}"
fi
PREV_REPO="${PREV_REPO:-ghcr.io/bingoscape/bingoscape}"
if [ -n "$PREV_IMAGE_ID" ]; then
    log "Currently running: ${PREV_TAG:-unknown tag} (${PREV_IMAGE_ID})"
else
    log "No app container is running yet (first deploy): rollback is not possible"
fi

# --- 3. pull images -----------------------------------------------------------
log "Pulling images"
registry_login
dc pull app migrate
registry_logout

# --- 4. pre-deploy backup -----------------------------------------------------
if [ -n "$(docker ps -q --filter 'name=^bingoscape-postgres$' --filter status=running)" ]; then
    log "Creating pre-deploy database backup"
    "$APP_DIR/scripts/backup-db.sh" pre-deploy "$IMAGE_TAG" || die "Pre-deploy backup failed, aborting"
else
    log "PostgreSQL container is not running (first deploy?), skipping backup"
fi

# --- 5. migrations (before the new app starts) --------------------------------
log "Starting database"
dc up -d --wait --wait-timeout 120 postgres
log "Running migrations"
dc run --rm -T migrate

# --- 6. swap the app ----------------------------------------------------------
log "Starting app ${IMAGE_TAG}"
SWAPPED=1
# Record the tag in .env so manual 'docker compose' calls on the server use it too
set_env_var IMAGE_TAG "$IMAGE_TAG"
dc up -d --no-deps --remove-orphans --wait --wait-timeout 180 app
wait_for_health

# --- 7. done ------------------------------------------------------------------
printf '%s\n' "$IMAGE_TAG" > .deployed-tag.tmp
mv .deployed-tag.tmp .deployed-tag
SWAPPED=0
docker image prune -f > /dev/null 2>&1 || true
dc ps
log "Deploy of ${IMAGE_TAG} succeeded"
