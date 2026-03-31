-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardAssigned" BOOLEAN NOT NULL DEFAULT true,
    "cardComment" BOOLEAN NOT NULL DEFAULT true,
    "cardMoved" BOOLEAN NOT NULL DEFAULT true,
    "cardArchived" BOOLEAN NOT NULL DEFAULT true,
    "cardDueDate" BOOLEAN NOT NULL DEFAULT true,
    "ticketNew" BOOLEAN NOT NULL DEFAULT true,
    "ticketReply" BOOLEAN NOT NULL DEFAULT true,
    "emailCardAssigned" BOOLEAN NOT NULL DEFAULT false,
    "emailCardComment" BOOLEAN NOT NULL DEFAULT false,
    "emailTicketNew" BOOLEAN NOT NULL DEFAULT true,
    "emailTicketReply" BOOLEAN NOT NULL DEFAULT true,
    "muteAll" BOOLEAN NOT NULL DEFAULT false,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "notification_preferences"("userId");

-- Add type column to notifications
ALTER TABLE "notifications" ADD COLUMN "type" TEXT;
