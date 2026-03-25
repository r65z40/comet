-- AlterTable
ALTER TABLE "board_cards" ADD COLUMN "contactId" TEXT;

-- CreateIndex
CREATE INDEX "board_cards_contactId_idx" ON "board_cards"("contactId");

-- AddForeignKey
ALTER TABLE "board_cards" ADD CONSTRAINT "board_cards_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
