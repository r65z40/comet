-- Convert installations.status from enum InstallationStatus to TEXT
-- Must drop default first to remove dependency on the enum type
ALTER TABLE "installations" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "installations" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;
ALTER TABLE "installations" ALTER COLUMN "status" SET DEFAULT 'EN_PARC_GARANTIE';

-- Drop the now-unused enum
DROP TYPE IF EXISTS "InstallationStatus";
