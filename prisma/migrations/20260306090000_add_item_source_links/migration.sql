-- Add source link metadata for list/session items.
CREATE TYPE "SourceProvider" AS ENUM ('SPOTIFY', 'YOUTUBE');

ALTER TABLE "TemplateItem"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceProvider" "SourceProvider",
  ADD COLUMN "sourceNote" TEXT;

ALTER TABLE "SessionItem"
  ADD COLUMN "sourceUrl" TEXT,
  ADD COLUMN "sourceProvider" "SourceProvider",
  ADD COLUMN "sourceNote" TEXT;
