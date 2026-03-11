-- Add moderation metadata fields for templates and sessions.
ALTER TABLE "Template"
  ADD COLUMN "isModeratedHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderatedByUserId" TEXT,
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3);

ALTER TABLE "Session"
  ADD COLUMN "isModeratedHidden" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "moderatedByUserId" TEXT,
  ADD COLUMN "moderationReason" TEXT,
  ADD COLUMN "moderatedAt" TIMESTAMP(3);
