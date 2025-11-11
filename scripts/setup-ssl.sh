#!/bin/bash
set -e

# =============================================================================
# SSL Certificate Setup Script
# =============================================================================
# Run this script after deployment to generate SSL certificates
# Usage: ./scripts/setup-ssl.sh
# =============================================================================

DOMAIN="${1:-staging.bingoscape.org}"
EMAIL="${2:-sschubert932@gmail.com}"

echo "🔐 SSL Certificate Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Domain: $DOMAIN"
echo "Email:  $EMAIL"
echo ""

# Step 1: Backup current SSL config
echo "📦 Backing up SSL configuration..."
cp nginx/conf.d/default.conf nginx/conf.d/default.conf.ssl-backup
echo "✅ Backup created: nginx/conf.d/default.conf.ssl-backup"
echo ""

# Step 2: Switch to HTTP-only config
echo "🔄 Switching to HTTP-only configuration..."
cp nginx/conf.d/default-dev.conf.example nginx/conf.d/default.conf
echo "✅ HTTP-only config activated"
echo ""

# Step 3: Restart nginx
echo "♻️  Restarting nginx..."
docker compose restart nginx
sleep 3
echo "✅ Nginx restarted"
echo ""

# Step 4: Run certbot
echo "🎫 Generating SSL certificates with certbot..."
docker compose --profile certbot run --rm certbot
echo ""

# Step 5: Check if certificates were created
if [ -f "certificates/live/$DOMAIN/fullchain.pem" ]; then
    echo "✅ Certificates generated successfully!"
    echo ""

    # Step 6: Restore SSL config
    echo "🔄 Restoring SSL configuration..."
    cp nginx/conf.d/default.conf.ssl-backup nginx/conf.d/default.conf
    echo "✅ SSL config restored"
    echo ""

    # Step 7: Restart nginx with SSL
    echo "♻️  Restarting nginx with SSL..."
    docker compose restart nginx
    sleep 3
    echo "✅ Nginx restarted with SSL"
    echo ""

    echo "🎉 SSL setup complete!"
    echo ""
    echo "Certificate expires: $(openssl x509 -in certificates/live/$DOMAIN/fullchain.pem -noout -enddate | cut -d= -f2)"
    echo ""
    echo "Visit: https://$DOMAIN"
else
    echo "❌ Certificate generation failed!"
    echo "Restoring SSL config anyway..."
    cp nginx/conf.d/default.conf.ssl-backup nginx/conf.d/default.conf
    docker compose restart nginx
    exit 1
fi
