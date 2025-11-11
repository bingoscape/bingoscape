#!/bin/bash
# Check upload permissions and container user

echo "=== Upload Directory Permissions ==="
ls -lad ~/bingoscape/uploads
echo ""

echo "=== Upload Directory Contents ==="
ls -la ~/bingoscape/uploads | head -20
echo ""

echo "=== Container User Info ==="
docker compose exec app id
echo ""

echo "=== Test Write Permission in Container ==="
docker compose exec app touch /app/public/uploads/test-write-$(date +%s).txt && echo "✅ Write test successful" || echo "❌ Write test failed"
echo ""

echo "=== Container Upload Directory Permissions ==="
docker compose exec app ls -lad /app/public/uploads
echo ""
