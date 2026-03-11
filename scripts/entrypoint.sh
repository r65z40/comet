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

  echo "=== Migrations done ==="
else
  echo "WARNING: Could not connect to database, skipping migrations."
fi

echo "=== Starting application ==="
exec node server.js
