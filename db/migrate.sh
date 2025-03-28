#!/bin/bash
set -e

# Create backups directory if it doesn't exist
mkdir -p db/backups

# Function to check if database exists
check_db_exists() {
    docker-compose exec -T db psql -U postgres -tAc "SELECT 1 FROM pg_database WHERE datname='bingoscape-next'"
}

# Function to restore database
restore_database() {
    echo "Restoring database from backup..."
    docker-compose exec -T db psql -U postgres -d bingoscape-next < db/backups/bingoscape-backup.sql
    echo "Database restored successfully!"
}

# Main migration process
echo "Starting database migration process..."

# Check if backup file exists
if [ ! -f "db/backups/bingoscape-backup.sql" ]; then
    echo "Error: Backup file not found at db/backups/bingoscape-backup.sql"
    echo "Please copy your backup file to this location"
    exit 1
fi

# Start containers if not running
if ! docker-compose ps | grep -q "Up"; then
    echo "Starting containers..."
    docker-compose up -d
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
until docker-compose exec -T db pg_isready -U postgres; do
    echo "PostgreSQL is unavailable - sleeping"
    sleep 1
done
echo "PostgreSQL is ready!"

# Check if database exists
if [ "$(check_db_exists)" = "1" ]; then
    echo "Database already exists. Do you want to:"
    echo "1) Drop and recreate the database"
    echo "2) Skip migration"
    read -p "Enter your choice (1 or 2): " choice
    
    if [ "$choice" = "1" ]; then
        echo "Dropping existing database..."
        docker-compose exec -T db psql -U postgres -c "DROP DATABASE bingoscape-next;"
        docker-compose exec -T db psql -U postgres -c "CREATE DATABASE bingoscape-next;"
    else
        echo "Migration skipped."
        exit 0
    fi
fi

# Restore the database
restore_database

echo "Migration completed successfully!" 