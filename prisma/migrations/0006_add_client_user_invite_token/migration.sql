-- CreateTable (was previously created via db push, adding here for migration history)
CREATE TABLE IF NOT EXISTS "client_users" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "client_users_email_key" ON "client_users"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "client_users_clientId_idx" ON "client_users"("clientId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_users_clientId_fkey') THEN
    ALTER TABLE "client_users" ADD CONSTRAINT "client_users_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable (was previously created via db push, adding here for migration history)
CREATE TABLE IF NOT EXISTS "client_portal_settings" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "primaryColor" TEXT NOT NULL DEFAULT '#3b82f6',
    "headerLogo" TEXT,
    "welcomeMessage" TEXT,
    "footerText" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "client_portal_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "client_portal_settings_clientId_key" ON "client_portal_settings"("clientId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_portal_settings_clientId_fkey') THEN
    ALTER TABLE "client_portal_settings" ADD CONSTRAINT "client_portal_settings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable (was previously created via db push)
CREATE TABLE IF NOT EXISTS "password_resets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_resets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "password_resets_token_key" ON "password_resets"("token");
CREATE INDEX IF NOT EXISTS "password_resets_token_idx" ON "password_resets"("token");
CREATE INDEX IF NOT EXISTS "password_resets_userId_idx" ON "password_resets"("userId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'password_resets_userId_fkey') THEN
    ALTER TABLE "password_resets" ADD CONSTRAINT "password_resets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable (was previously created via db push)
CREATE TABLE IF NOT EXISTS "installation_history" (
    "id" TEXT NOT NULL,
    "installationId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "installation_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "installation_history_installationId_idx" ON "installation_history"("installationId");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'installation_history_installationId_fkey') THEN
    ALTER TABLE "installation_history" ADD CONSTRAINT "installation_history_installationId_fkey" FOREIGN KEY ("installationId") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateTable (was previously created via db push)
CREATE TABLE IF NOT EXISTS "activity_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "activity_logs_entity_entityId_idx" ON "activity_logs"("entity", "entityId");
CREATE INDEX IF NOT EXISTS "activity_logs_createdAt_idx" ON "activity_logs"("createdAt");
CREATE INDEX IF NOT EXISTS "activity_logs_userId_idx" ON "activity_logs"("userId");

-- Add missing columns/indexes to existing tables
CREATE INDEX IF NOT EXISTS "installations_status_endDate_idx" ON "installations"("status", "endDate");

-- Add deletedAt columns if not exists
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'deletedAt') THEN
    ALTER TABLE "clients" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'deletedAt') THEN
    ALTER TABLE "products" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installations' AND column_name = 'deletedAt') THEN
    ALTER TABLE "installations" ADD COLUMN "deletedAt" TIMESTAMP(3);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'installations' AND column_name = 'invoiceLineId') THEN
    ALTER TABLE "installations" ADD COLUMN "invoiceLineId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'clientType') THEN
    ALTER TABLE "clients" ADD COLUMN "clientType" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'clients' AND column_name = 'logoUrl') THEN
    ALTER TABLE "clients" ADD COLUMN "logoUrl" TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "clients_deletedAt_idx" ON "clients"("deletedAt");
CREATE INDEX IF NOT EXISTS "products_deletedAt_idx" ON "products"("deletedAt");
CREATE INDEX IF NOT EXISTS "installations_deletedAt_idx" ON "installations"("deletedAt");
CREATE UNIQUE INDEX IF NOT EXISTS "installations_invoiceLineId_key" ON "installations"("invoiceLineId");

-- Original migration: AlterTable
ALTER TABLE "client_users" ADD COLUMN IF NOT EXISTS "inviteToken" TEXT,
ADD COLUMN IF NOT EXISTS "inviteTokenExpiry" TIMESTAMP(3);

-- AlterTable: make password optional (default empty for invite-based users)
ALTER TABLE "client_users" ALTER COLUMN "password" SET DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "client_users_inviteToken_key" ON "client_users"("inviteToken");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "client_users_inviteToken_idx" ON "client_users"("inviteToken");
