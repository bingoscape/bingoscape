#!/bin/bash
set -e

# Check if .env file exists
if [ -f .env ]; then
    echo "Warning: .env file already exists"
    read -p "Do you want to overwrite it? (y/N): " -r REPLY
    if ! [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborting..."
        exit 1
    fi
fi

# Create .env file with template
cat > .env << 'EOL'
# Database
DATABASE_URL=postgres://postgres:your_secure_password@db:5432/bingoscape-next

# App Configuration
NODE_ENV=production
PORT=3344

# Add other environment variables as needed
# Example:
# NEXT_PUBLIC_API_URL=https://api.example.com
# SESSION_SECRET=your_session_secret
EOL

echo "Created .env file with template"
echo "Please edit the .env file with your production values"
echo "You can use: nano .env or vim .env" 