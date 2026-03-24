-- AlterTable
ALTER TABLE "clients" ADD COLUMN "mobile" TEXT;
ALTER TABLE "clients" ADD COLUMN "fax" TEXT;
ALTER TABLE "clients" ADD COLUMN "website" TEXT;
ALTER TABLE "clients" ADD COLUMN "siret" TEXT;
ALTER TABLE "clients" ADD COLUMN "addressComplement" TEXT;
ALTER TABLE "clients" ADD COLUMN "notes" TEXT;

-- CreateTable
CREATE TABLE "contacts" (
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
CREATE UNIQUE INDEX "contacts_axonautId_key" ON "contacts"("axonautId");

-- CreateIndex
CREATE INDEX "contacts_clientId_idx" ON "contacts"("clientId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
