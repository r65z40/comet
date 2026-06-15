-- Add new notification preference columns
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "backupError" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "securityAlert" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "emailBackupError" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "notification_preferences" ADD COLUMN IF NOT EXISTS "emailSecurityAlert" BOOLEAN NOT NULL DEFAULT true;

-- Add missing indexes on invoices
CREATE INDEX IF NOT EXISTS "invoices_clientId_idx" ON "invoices"("clientId");
CREATE INDEX IF NOT EXISTS "invoices_invoiceDate_idx" ON "invoices"("invoiceDate");
CREATE INDEX IF NOT EXISTS "invoices_invoiceNumber_clientId_idx" ON "invoices"("invoiceNumber", "clientId");

-- Add missing indexes on sync_logs
CREATE INDEX IF NOT EXISTS "sync_logs_type_status_idx" ON "sync_logs"("type", "status");
CREATE INDEX IF NOT EXISTS "sync_logs_startedAt_idx" ON "sync_logs"("startedAt");
