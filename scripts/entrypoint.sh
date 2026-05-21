#!/bin/sh
# Entrypoint: run DB migrations then start the app

echo "=== Comet startup ==="

# Strip Prisma-specific query params (?schema=public) that psql doesn't understand
DB_URL=$(echo "$DATABASE_URL" | cut -d'?' -f1)

# Wait for database to be ready (max 30 seconds)
RETRIES=15
DB_READY=0
while [ "$RETRIES" -gt 0 ]; do
  if psql "$DB_URL" -c "SELECT 1" > /dev/null 2>&1; then
    DB_READY=1
    break
  fi
  RETRIES=$((RETRIES - 1))
  echo "Waiting for database... ($RETRIES retries left)"
  sleep 2
done

if [ "$DB_READY" = "1" ]; then
  echo "Database is ready. Running Prisma migrations..."
  npx prisma migrate deploy 2>&1 || echo "Prisma migrate returned non-zero (may be OK on first run)"

  # Seed admin user if users table is empty (fresh install)
  USER_COUNT=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM users" 2>/dev/null | tr -d ' ')
  if [ "$USER_COUNT" = "0" ] 2>/dev/null; then
    echo "No users found — running seed..."
    npx tsx prisma/seed.ts 2>&1 || echo "Seed returned non-zero"
  fi

  echo "=== Migrations done ==="
else
  echo "WARNING: Could not connect to database, skipping migrations."
fi

echo "=== Starting application ==="

# Start background cron loop: calls /api/cron every 5 minutes
CRON_SECRET="${CRON_SECRET:-comet_cron_secret_2024}"
(
  sleep 20
  echo "=== Cron scheduler started (every 5 min, TZ=Europe/Paris) ==="
  while true; do
    RESULT=$(curl -sf --max-time 30 -H "x-cron-secret: ${CRON_SECRET}" "http://localhost:3000/api/cron" 2>&1) || true
    if [ -n "$RESULT" ]; then
      echo "[CRON] $(date '+%Y-%m-%d %H:%M:%S') $RESULT"
    fi
    sleep 300
  done
) &

exec node server.js
