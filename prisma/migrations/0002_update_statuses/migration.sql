-- Rename enum values
ALTER TYPE "InstallationStatus" RENAME VALUE 'ACTIF' TO 'EN_PARC_GARANTIE';
ALTER TYPE "InstallationStatus" RENAME VALUE 'EXPIRE' TO 'EN_PARC_HORS_GARANTIE';
ALTER TYPE "InstallationStatus" RENAME VALUE 'BIENTOT_EXPIRE' TO 'RENOUVELE';

-- Update existing installations: recalculate statuses
UPDATE installations SET status = 'EN_PARC_GARANTIE' WHERE "endDate" > NOW();
UPDATE installations SET status = 'EN_PARC_HORS_GARANTIE' WHERE "endDate" <= NOW();

-- Alter default
ALTER TABLE installations ALTER COLUMN status SET DEFAULT 'EN_PARC_GARANTIE'::"InstallationStatus";
