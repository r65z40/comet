-- AlterTable
ALTER TABLE "client_portal_settings" ADD COLUMN "welcomeTitle" TEXT,
ADD COLUMN "welcomeContent" TEXT,
ADD COLUMN "showStats" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "showExpiring" BOOLEAN NOT NULL DEFAULT true;
