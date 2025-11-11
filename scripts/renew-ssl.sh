#!/bin/bash
set -e

# =============================================================================
# SSL Certificate Renewal Script
# =============================================================================
# Based on: https://stackoverflow.com/a/66641297
# Run daily via cron to check and renew SSL certificates
# =============================================================================

cd ~/bingoscape

# Run certbot renewal (only renews if cert is within 30 days of expiry)
docker compose --profile certbot run --rm certbot renew

# Reload nginx to pick up renewed certificates
docker compose exec nginx nginx -s reload
