ALTER TABLE "Template"
ADD COLUMN "isHidden" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Session"
ADD COLUMN "sourceTemplateId" TEXT;
