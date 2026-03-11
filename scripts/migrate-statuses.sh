#!/bin/bash
# Script to migrate InstallationStatus enum to plain text column
# This runs automatically on container start via entrypoint.sh
# Run manually only if needed: docker compose exec db psql -U comet comet_cedelia < scripts/migrate.sql

echo "=== Migration des statuts d'installation ==="

docker compose exec db psql -U comet comet_cedelia -c "
DO \$\$
BEGIN
  -- Check if InstallationStatus enum type exists
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InstallationStatus') THEN
    RAISE NOTICE 'Found InstallationStatus enum, migrating to text...';

    -- Rename old enum values if needed
    BEGIN
      ALTER TYPE \"InstallationStatus\" RENAME VALUE 'ACTIF' TO 'EN_PARC_GARANTIE';
    EXCEPTION WHEN others THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE \"InstallationStatus\" RENAME VALUE 'EXPIRE' TO 'EN_PARC_HORS_GARANTIE';
    EXCEPTION WHEN others THEN
      NULL;
    END;
    BEGIN
      ALTER TYPE \"InstallationStatus\" RENAME VALUE 'BIENTOT_EXPIRE' TO 'RENOUVELE';
    EXCEPTION WHEN others THEN
      NULL;
    END;

    -- Convert column from enum to text
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT NULL;
    ALTER TABLE installations ALTER COLUMN status TYPE TEXT USING status::TEXT;
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT 'EN_PARC_GARANTIE';

    -- Drop the old enum type
    DROP TYPE \"InstallationStatus\";

    -- Recalculate statuses based on endDate
    UPDATE installations SET status = 'EN_PARC_GARANTIE' WHERE \"endDate\" > NOW();
    UPDATE installations SET status = 'EN_PARC_HORS_GARANTIE' WHERE \"endDate\" <= NOW();

    RAISE NOTICE 'Migration effectuée avec succès';
  ELSE
    RAISE NOTICE 'Pas d''enum trouvé, migration déjà effectuée';
  END IF;

  -- Ensure invoiceLineId column exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'installations' AND column_name = 'invoiceLineId'
  ) THEN
    ALTER TABLE installations ADD COLUMN \"invoiceLineId\" TEXT;
    CREATE UNIQUE INDEX IF NOT EXISTS \"installations_invoiceLineId_key\" ON installations(\"invoiceLineId\");
    RAISE NOTICE 'Colonne invoiceLineId ajoutée';
  END IF;
END \$\$;
"

echo "=== Terminé ==="
