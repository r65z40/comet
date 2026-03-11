#!/bin/sh
set -e

echo "=== Running database migrations ==="

# Wait for database to be ready
until psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; do
  echo "Waiting for database..."
  sleep 2
done

echo "Database is ready."

# Check if status column is still an enum type and convert to text
psql "$DATABASE_URL" -v ON_ERROR_STOP=0 <<'SQL'
DO $$
BEGIN
  -- Check if InstallationStatus enum type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallationStatus') THEN
    RAISE NOTICE 'Found InstallationStatus enum, migrating to text...';

    -- Rename old enum values if needed (ignore errors if already renamed)
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

    -- Convert column from enum to text
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT NULL;
    ALTER TABLE installations ALTER COLUMN status TYPE TEXT USING status::TEXT;
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT 'EN_PARC_GARANTIE';

    -- Drop the old enum type
    DROP TYPE "InstallationStatus";

    -- Recalculate statuses based on endDate
    UPDATE installations SET status = 'EN_PARC_GARANTIE' WHERE "endDate" > NOW();
    UPDATE installations SET status = 'EN_PARC_HORS_GARANTIE' WHERE "endDate" <= NOW();

    RAISE NOTICE 'Migration complete: status column converted to text.';
  ELSE
    RAISE NOTICE 'No enum migration needed.';
  END IF;

  -- Ensure invoiceLineId column exists
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

echo "=== Migrations complete ==="
echo "=== Starting application ==="
exec node server.js
