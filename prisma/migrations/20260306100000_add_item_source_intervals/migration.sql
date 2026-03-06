-- Add optional source interval fields (currently used for YouTube).
ALTER TABLE "TemplateItem"
  ADD COLUMN "sourceStartSec" INTEGER,
  ADD COLUMN "sourceEndSec" INTEGER;

ALTER TABLE "SessionItem"
  ADD COLUMN "sourceStartSec" INTEGER,
  ADD COLUMN "sourceEndSec" INTEGER;
