CREATE TABLE "IdentityEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "deviceId" TEXT,
    "relatedUserId" TEXT,
    "reason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdentityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "IdentityEvent_userId_createdAt_idx" ON "IdentityEvent"("userId", "createdAt");
CREATE INDEX "IdentityEvent_deviceId_createdAt_idx" ON "IdentityEvent"("deviceId", "createdAt");
CREATE INDEX "IdentityEvent_type_createdAt_idx" ON "IdentityEvent"("type", "createdAt");
