-- InstallationHistory: compound index for screen-feed status change queries
CREATE INDEX IF NOT EXISTS "installation_history_field_createdAt_idx" ON "installation_history"("field", "createdAt");

-- BoardCard: compound index for main board query (filter by column+archived, order by position)
CREATE INDEX IF NOT EXISTS "board_cards_columnId_archived_position_idx" ON "board_cards"("columnId", "archived", "position");

-- BoardCard: index on createdById for notification lookups
CREATE INDEX IF NOT EXISTS "board_cards_createdById_idx" ON "board_cards"("createdById");

-- Ticket: index on createdAt for sorting/listing
CREATE INDEX IF NOT EXISTS "tickets_createdAt_idx" ON "tickets"("createdAt");
