-- CreateTable
CREATE TABLE "quota_alerts" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "clientName" TEXT,
    "alertType" TEXT NOT NULL,
    "usagePercent" DOUBLE PRECISION NOT NULL,
    "allocatedQuota" BIGINT,
    "currentUsage" BIGINT,
    "recipients" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "manual" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "quota_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quota_alerts_organizationId_idx" ON "quota_alerts"("organizationId");

-- CreateIndex
CREATE INDEX "quota_alerts_alertType_idx" ON "quota_alerts"("alertType");

-- CreateIndex
CREATE INDEX "quota_alerts_sentAt_idx" ON "quota_alerts"("sentAt");
