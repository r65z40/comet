#!/bin/sh
# Entrypoint: run DB migrations then start the app
# Never let migration errors prevent the app from starting

echo "=== Running database migrations ==="

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
  echo "Database is ready. Running migrations..."

  # Run migration - ignore all errors (best effort)
  psql "$DB_URL" <<'SQL' || echo "Migration SQL returned non-zero (may be OK)"
DO $$
BEGIN
  -- Check if InstallationStatus enum type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallationStatus') THEN
    RAISE NOTICE 'Found InstallationStatus enum, migrating to text...';

    BEGIN
      ALTER TYPE "InstallationStatus" RENAME VALUE 'ACTIF' TO 'EN_PARC_GARANTIE';
    EXCEPTION WHEN others THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE "InstallationStatus" RENAME VALUE 'EXPIRE' TO 'EN_PARC_HORS_GARANTIE';
    EXCEPTION WHEN others THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE "InstallationStatus" RENAME VALUE 'BIENTOT_EXPIRE' TO 'RENOUVELE';
    EXCEPTION WHEN others THEN
      NULL;
    END;

    ALTER TABLE installations ALTER COLUMN status SET DEFAULT NULL;
    ALTER TABLE installations ALTER COLUMN status TYPE TEXT USING status::TEXT;
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT 'EN_PARC_GARANTIE';
    DROP TYPE "InstallationStatus";

    UPDATE installations SET status = 'EN_PARC_GARANTIE' WHERE "endDate" > NOW();
    UPDATE installations SET status = 'EN_PARC_HORS_GARANTIE' WHERE "endDate" <= NOW();

    RAISE NOTICE 'Migration complete: status column converted to text.';
  ELSE
    RAISE NOTICE 'No enum migration needed.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'installations' AND column_name = 'invoiceLineId'
  ) THEN
    ALTER TABLE installations ADD COLUMN "invoiceLineId" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS "installations_invoiceLineId_key" ON installations("invoiceLineId");
    RAISE NOTICE 'Added invoiceLineId column.';
  END IF;
END $$;
SQL

  # Add missing columns to various tables
  psql "$DB_URL" <<'SQL2' || echo "Column migrations returned non-zero (may be OK)"
DO $$
BEGIN
  -- clients: clientType, logoUrl
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'clientType'
  ) THEN
    ALTER TABLE clients ADD COLUMN "clientType" TEXT;
    RAISE NOTICE 'Added clientType column.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'clients' AND column_name = 'logoUrl'
  ) THEN
    ALTER TABLE clients ADD COLUMN "logoUrl" TEXT;
    RAISE NOTICE 'Added logoUrl column.';
  END IF;

  -- installations: alwaysInFleet
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'installations' AND column_name = 'alwaysInFleet'
  ) THEN
    ALTER TABLE installations ADD COLUMN "alwaysInFleet" BOOLEAN NOT NULL DEFAULT false;
    RAISE NOTICE 'Added alwaysInFleet column.';
  END IF;

  -- invoice_lines: purchasePrice
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoice_lines' AND column_name = 'purchasePrice'
  ) THEN
    ALTER TABLE invoice_lines ADD COLUMN "purchasePrice" DOUBLE PRECISION;
    RAISE NOTICE 'Added purchasePrice column.';
  END IF;

  -- installations: composite index on status + endDate
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'installations' AND indexname = 'installations_status_endDate_idx'
  ) THEN
    CREATE INDEX "installations_status_endDate_idx" ON installations("status", "endDate");
    RAISE NOTICE 'Added status+endDate composite index.';
  END IF;
END $$;
SQL2

  # Create password_resets table for forgot password feature
  psql "$DB_URL" <<'SQL3' || echo "Password resets migration returned non-zero (may be OK)"
CREATE TABLE IF NOT EXISTS password_resets (
  id TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  used BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON password_resets(token);
CREATE INDEX IF NOT EXISTS "password_resets_userId_idx" ON password_resets("userId");
SQL3

  echo "=== Migrations done ==="
else
  echo "WARNING: Could not connect to database, skipping migrations."
fi

echo "=== Starting application ==="

# Start background cron loop: calls /api/cron every 5 minutes
# This checks alert scheduling settings and sends email notifications
CRON_SECRET="${CRON_SECRET:-comet_cron_secret_2024}"
(
  # Wait for the app to be ready
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
