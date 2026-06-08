-- Drop the userId column from calendar_feeds (feeds are now global, admin-managed)
ALTER TABLE "calendar_feeds" DROP COLUMN IF EXISTS "userId";

-- CreateTable
CREATE TABLE "calendar_feed_visibility" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "hidden" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "calendar_feed_visibility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_feed_visibility_userId_idx" ON "calendar_feed_visibility"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "calendar_feed_visibility_userId_feedId_key" ON "calendar_feed_visibility"("userId", "feedId");

-- AddForeignKey
ALTER TABLE "calendar_feed_visibility" ADD CONSTRAINT "calendar_feed_visibility_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "calendar_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Drop old index
DROP INDEX IF EXISTS "calendar_feeds_userId_idx";
