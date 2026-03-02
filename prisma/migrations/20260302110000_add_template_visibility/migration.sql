ALTER TABLE "Template"
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Template"
SET "isPublic" = true;
