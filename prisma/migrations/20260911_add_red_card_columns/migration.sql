-- Add red card tracking to board columns
ALTER TABLE "board_columns" ADD COLUMN IF NOT EXISTS "redCardEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "board_columns" ADD COLUMN IF NOT EXISTS "redCardCount" INTEGER NOT NULL DEFAULT 0;
