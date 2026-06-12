-- CreateTable
CREATE TABLE "oxibox_snapshots" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "machineCount" INTEGER NOT NULL DEFAULT 0,
    "ongoingBackup" BOOLEAN NOT NULL DEFAULT false,
    "allocatedQuota" BIGINT,
    "currentUsage" BIGINT,
    "date" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oxibox_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "oxibox_snapshots_organizationId_date_key" ON "oxibox_snapshots"("organizationId", "date");

-- CreateIndex
CREATE INDEX "oxibox_snapshots_organizationId_idx" ON "oxibox_snapshots"("organizationId");

-- CreateIndex
CREATE INDEX "oxibox_snapshots_date_idx" ON "oxibox_snapshots"("date");

-- CreateIndex
CREATE INDEX "oxibox_snapshots_status_idx" ON "oxibox_snapshots"("status");
