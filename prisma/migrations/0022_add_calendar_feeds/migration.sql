-- CreateTable
CREATE TABLE "calendar_feeds" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "calendar_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "calendar_feeds_userId_idx" ON "calendar_feeds"("userId");
