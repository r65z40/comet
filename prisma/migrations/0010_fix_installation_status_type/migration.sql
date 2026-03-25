-- Convert installations.status from enum InstallationStatus to TEXT
ALTER TABLE "installations" ALTER COLUMN "status" SET DEFAULT 'EN_PARC_GARANTIE';
ALTER TABLE "installations" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

-- Drop the now-unused enum
DROP TYPE IF EXISTS "InstallationStatus";
