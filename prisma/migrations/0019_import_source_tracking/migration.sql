-- Track import source for all importable entities
ALTER TABLE "clients" ADD COLUMN "importSource" TEXT;
ALTER TABLE "clients" ADD COLUMN "importDetails" TEXT;

ALTER TABLE "contacts" ADD COLUMN "importSource" TEXT;
ALTER TABLE "contacts" ADD COLUMN "importDetails" TEXT;

ALTER TABLE "products" ADD COLUMN "importSource" TEXT;
ALTER TABLE "products" ADD COLUMN "importDetails" TEXT;

ALTER TABLE "invoices" ADD COLUMN "importSource" TEXT;
ALTER TABLE "invoices" ADD COLUMN "importDetails" TEXT;

ALTER TABLE "invoice_lines" ADD COLUMN "importSource" TEXT;
ALTER TABLE "invoice_lines" ADD COLUMN "importDetails" TEXT;

ALTER TABLE "installations" ADD COLUMN "importSource" TEXT;
ALTER TABLE "installations" ADD COLUMN "importDetails" TEXT;

-- Backfill existing records: mark Axonaut-synced records
UPDATE "clients" SET "importSource" = 'axonaut' WHERE "axonautId" IS NOT NULL AND "importSource" IS NULL;
UPDATE "contacts" SET "importSource" = 'axonaut' WHERE "axonautId" IS NOT NULL AND "importSource" IS NULL;
UPDATE "products" SET "importSource" = 'axonaut' WHERE "axonautId" IS NOT NULL AND "importSource" IS NULL;
UPDATE "invoices" SET "importSource" = 'axonaut' WHERE "axonautId" IS NOT NULL AND "importSource" IS NULL;
