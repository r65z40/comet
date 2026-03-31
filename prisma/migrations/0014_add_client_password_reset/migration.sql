-- CreateTable
CREATE TABLE "client_password_resets" (
    "id" TEXT NOT NULL,
    "clientUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_password_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "client_password_resets_token_key" ON "client_password_resets"("token");

-- CreateIndex
CREATE INDEX "client_password_resets_token_idx" ON "client_password_resets"("token");

-- CreateIndex
CREATE INDEX "client_password_resets_clientUserId_idx" ON "client_password_resets"("clientUserId");

-- AddForeignKey
ALTER TABLE "client_password_resets" ADD CONSTRAINT "client_password_resets_clientUserId_fkey" FOREIGN KEY ("clientUserId") REFERENCES "client_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
