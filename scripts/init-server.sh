#!/bin/bash
# Server initialization script
# This script sets up the required directories and permissions for Bingoscape deployment
# Run this once on a new server before first deployment

set -e

echo "🚀 Initializing Bingoscape server directories..."

# Define application directory
APP_DIR="${APP_DIR:-$HOME/bingoscape}"

echo "📁 Application directory: $APP_DIR"

# Create application directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
  echo "Creating application directory..."
  mkdir -p "$APP_DIR"
fi

# Create uploads directory with proper permissions
echo "📁 Setting up uploads directory..."
mkdir -p "$APP_DIR/uploads"
# UID 1001 = nextjs user in container
sudo chown 1001:1001 "$APP_DIR/uploads" 2>/dev/null || chown 1001:1001 "$APP_DIR/uploads" || {
  echo "⚠️  Warning: Could not set ownership to 1001:1001. Trying current user..."
  chown $(whoami):$(whoami) "$APP_DIR/uploads"
}
sudo chmod 775 "$APP_DIR/uploads" 2>/dev/null || chmod 775 "$APP_DIR/uploads"
echo "✅ Uploads directory created with proper permissions"

# Create the OSRS Wiki image cache directory (mounted at /app/data/osrs-images)
echo "📁 Setting up OSRS image cache directory..."
mkdir -p "$APP_DIR/osrs-image-cache"
sudo chown 1001:1001 "$APP_DIR/osrs-image-cache" 2>/dev/null || chown 1001:1001 "$APP_DIR/osrs-image-cache" || {
  echo "⚠️  Warning: Could not set ownership to 1001:1001. Trying current user..."
  chown $(whoami):$(whoami) "$APP_DIR/osrs-image-cache"
}
sudo chmod 775 "$APP_DIR/osrs-image-cache" 2>/dev/null || chmod 775 "$APP_DIR/osrs-image-cache"
echo "✅ OSRS image cache directory created with proper permissions"

# Create scripts directory
echo "📁 Setting up scripts directory..."
mkdir -p "$APP_DIR/scripts"
echo "✅ Scripts directory created"

echo ""
echo "✅ Server initialization completed successfully!"
echo ""
echo "Next steps:"
echo "1. Copy your .env file to $APP_DIR/.env"
echo "2. Run a deployment from GitHub Actions"
echo "3. Verify the application is running: docker compose ps"
