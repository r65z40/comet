-- AlterTable
ALTER TABLE "client_users" ADD COLUMN "inviteToken" TEXT,
ADD COLUMN "inviteTokenExpiry" TIMESTAMP(3);

-- AlterTable: make password optional (default empty for invite-based users)
ALTER TABLE "client_users" ALTER COLUMN "password" SET DEFAULT '';

-- CreateIndex
CREATE UNIQUE INDEX "client_users_inviteToken_key" ON "client_users"("inviteToken");

-- CreateIndex
CREATE INDEX "client_users_inviteToken_idx" ON "client_users"("inviteToken");
