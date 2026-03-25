-- AlterTable
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "mobile" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "fax" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "website" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "siret" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "addressComplement" TEXT;
ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "notes" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "contacts" (
    "id" TEXT NOT NULL,
    "axonautId" INTEGER,
    "clientId" TEXT NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "jobTitle" TEXT,
    "isBillingContact" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_axonautId_key" ON "contacts"("axonautId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "contacts_clientId_idx" ON "contacts"("clientId");

-- AddForeignKey
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_clientId_fkey') THEN
    ALTER TABLE "contacts" ADD CONSTRAINT "contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
