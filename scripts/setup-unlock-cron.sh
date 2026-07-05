#!/bin/bash

# Setup Cron Job for Bingoscape Next Automated Unlocks
# This script configures a Linux cron job to call the /api/cron/unlock endpoint every minute.

# Configuration
DOMAIN="https://bingoscape.org"
CRON_SECRET=""
# Resolve paths reliably regardless of where the script is called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$APP_DIR/.env"

# Load environment variables if .env exists
if [ -f "$ENV_FILE" ]; then
  source "$ENV_FILE"
fi

echo "Setting up automated unlock cron job..."

if [ -z "$CRON_SECRET" ]; then
  echo "WARNING: CRON_SECRET is not set in your .env file or environment."
  echo "The cron job will be setup, but it might fail if the API requires a secret."
  read -p "Enter your CRON_SECRET (leave blank to skip): " input_secret
  if [ ! -z "$input_secret" ]; then
    CRON_SECRET="$input_secret"
  fi
fi

# Determine the curl command
CURL_CMD="curl -s -X GET \"$DOMAIN/api/cron/unlock\""
if [ ! -z "$CRON_SECRET" ]; then
  CURL_CMD="curl -s -X GET -H \"Authorization: Bearer $CRON_SECRET\" \"$DOMAIN/api/cron/unlock\""
fi

CRON_JOB="* * * * * $CURL_CMD > /dev/null 2>&1"

# Check if the job already exists
(crontab -l 2>/dev/null | grep -F "$DOMAIN/api/cron/unlock") > /dev/null
if [ $? -eq 0 ]; then
  echo "Cron job for unlocking already exists in crontab."
else
  # Add the cron job
  (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
  echo "Cron job successfully added to run every minute."
fi

echo "Done."
