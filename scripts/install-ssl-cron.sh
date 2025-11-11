#!/bin/bash
set -e

# =============================================================================
# Install SSL Certificate Auto-Renewal Cron Job
# =============================================================================
# Based on: https://stackoverflow.com/a/66641297
# Sets up daily cron job to automatically renew SSL certificates
# =============================================================================

echo "Installing SSL certificate auto-renewal cron job..."
echo ""

# Add cron job to run renewal script daily at 3 AM
CRON_LINE="0 3 * * * cd ~/bingoscape && ./scripts/renew-ssl.sh >> ~/bingoscape/ssl-renewal.log 2>&1"

# Check if cron job already exists
if crontab -l 2>/dev/null | grep -q "renew-ssl.sh"; then
    echo "✅ Cron job already installed"
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "$CRON_LINE") | crontab -
    echo "✅ Cron job installed - will run daily at 3 AM"
fi

echo ""
echo "To view your crontab:"
echo "  crontab -l"
echo ""
echo "To test renewal manually:"
echo "  cd ~/bingoscape && ./scripts/renew-ssl.sh"
echo ""
echo "Renewal logs will be saved to:"
echo "  ~/bingoscape/ssl-renewal.log"
echo ""
