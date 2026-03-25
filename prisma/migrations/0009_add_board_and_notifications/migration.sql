-- Add missing columns to client_portal_settings
ALTER TABLE "client_portal_settings" ADD COLUMN IF NOT EXISTS "showFamily" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "showSupplier" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "showDuration" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "showQuantity" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "showComParc" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable: board_columns
CREATE TABLE "board_columns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable: board_cards
CREATE TABLE "board_cards" (
    "id" TEXT NOT NULL,
    "columnId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "position" INTEGER NOT NULL DEFAULT 0,
    "clientId" TEXT,
    "assigneeId" TEXT,
    "createdById" TEXT,
    "dueDate" TIMESTAMP(3),
    "links" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "board_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable: card_comments
CREATE TABLE "card_comments" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: card_attachments
CREATE TABLE "card_attachments" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileType" TEXT,
    "fileSize" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable: card_tags
CREATE TABLE "card_tags" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',

    CONSTRAINT "card_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable: card_tag_links
CREATE TABLE "card_tag_links" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "card_tag_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable: notifications
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex: board_cards
CREATE INDEX "board_cards_columnId_idx" ON "board_cards"("columnId");
CREATE INDEX "board_cards_clientId_idx" ON "board_cards"("clientId");
CREATE INDEX "board_cards_assigneeId_idx" ON "board_cards"("assigneeId");
CREATE INDEX "board_cards_priority_idx" ON "board_cards"("priority");

-- CreateIndex: card_comments
CREATE INDEX "card_comments_cardId_idx" ON "card_comments"("cardId");

-- CreateIndex: card_attachments
CREATE INDEX "card_attachments_cardId_idx" ON "card_attachments"("cardId");

-- CreateIndex: card_tags
CREATE UNIQUE INDEX "card_tags_name_key" ON "card_tags"("name");

-- CreateIndex: card_tag_links
CREATE UNIQUE INDEX "card_tag_links_cardId_tagId_key" ON "card_tag_links"("cardId", "tagId");

-- CreateIndex: notifications
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- AddForeignKey: board_cards -> board_columns
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_columnId_fkey" FOREIGN KEY ("columnId") REFERENCES "board_columns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: board_cards -> clients
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey: card_comments -> board_cards
ALTER TABLE "card_comments" ADD CONSTRAINT "card_comments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "board_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: card_attachments -> board_cards
ALTER TABLE "card_attachments" ADD CONSTRAINT "card_attachments_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "board_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: card_tag_links -> board_cards
ALTER TABLE "card_tag_links" ADD CONSTRAINT "card_tag_links_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "board_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: card_tag_links -> card_tags
ALTER TABLE "card_tag_links" ADD CONSTRAINT "card_tag_links_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "card_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
