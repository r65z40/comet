#!/bin/bash
# Script to migrate enum values from old to new statuses
# Run this BEFORE doing prisma db push

echo "=== Migration des statuts d'installation ==="

# Execute SQL directly via the database container
docker compose exec db psql -U comet comet_cedelia -c "
DO \$\$
BEGIN
  -- Check if old values exist
  IF EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ACTIF' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'InstallationStatus')) THEN
    -- Rename old enum values to new ones
    ALTER TYPE \"InstallationStatus\" RENAME VALUE 'ACTIF' TO 'EN_PARC_GARANTIE';
    ALTER TYPE \"InstallationStatus\" RENAME VALUE 'EXPIRE' TO 'EN_PARC_HORS_GARANTIE';
    ALTER TYPE \"InstallationStatus\" RENAME VALUE 'BIENTOT_EXPIRE' TO 'RENOUVELE';

    -- Recalculate statuses based on endDate
    UPDATE installations SET status = 'EN_PARC_GARANTIE' WHERE \"endDate\" > NOW();
    UPDATE installations SET status = 'EN_PARC_HORS_GARANTIE' WHERE \"endDate\" <= NOW();

    -- Update default
    ALTER TABLE installations ALTER COLUMN status SET DEFAULT 'EN_PARC_GARANTIE'::\"InstallationStatus\";

    RAISE NOTICE 'Migration effectuée avec succès';
  ELSE
    RAISE NOTICE 'Migration déjà effectuée, rien à faire';
  END IF;
END \$\$;
"

echo "=== Synchronisation du schéma Prisma ==="
docker compose exec app npx prisma db push --accept-data-loss

echo "=== Terminé ==="
