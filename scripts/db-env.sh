#!/bin/bash
# Sourced by backup-db.sh and restore-db.sh (not executed directly).
#
# Resolves DB_NAME and DB_USER the same way docker-compose.yml does, so the
# scripts talk to the database the app actually uses:
#   1. value already in the environment
#   2. value in <app dir>/.env (the compose env file written by the deploy)
#   3. the docker-compose.yml default (DB_NAME=bingoscape, DB_USER=postgres)
#
# .env is parsed, not sourced: it is a docker compose env file, not shell syntax.

# read_dotenv_var <file> <NAME>: print the last NAME=value (surrounding quotes removed)
read_dotenv_var() {
    local file="$1" name="$2" line value
    [ -f "$file" ] || return 0
    line="$(grep -E "^${name}=" "$file" | tail -n 1)" || true
    [ -n "$line" ] || return 0
    value="${line#*=}"
    case "$value" in
        \"*\") value="${value:1:${#value}-2}" ;;
        \'*\') value="${value:1:${#value}-2}" ;;
    esac
    printf '%s' "$value"
}

# load_db_env <app dir>
load_db_env() {
    local app_dir="$1"
    DB_NAME="${DB_NAME:-$(read_dotenv_var "$app_dir/.env" DB_NAME)}"
    DB_USER="${DB_USER:-$(read_dotenv_var "$app_dir/.env" DB_USER)}"
    DB_NAME="${DB_NAME:-bingoscape}"
    DB_USER="${DB_USER:-postgres}"
}
