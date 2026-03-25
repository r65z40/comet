-- AlterTable
ALTER TABLE "client_portal_settings" ADD COLUMN IF NOT EXISTS "showHeaderRow" BOOLEAN NOT NULL DEFAULT true;
