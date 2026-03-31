-- Add lastAteraSyncAt to tickets
ALTER TABLE "tickets" ADD COLUMN "lastAteraSyncAt" TIMESTAMP(3);

-- Add ateraCommentId to ticket_comments for deduplication
ALTER TABLE "ticket_comments" ADD COLUMN "ateraCommentId" TEXT;
