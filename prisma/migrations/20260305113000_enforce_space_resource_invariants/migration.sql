UPDATE "Template"
SET "isPublic" = FALSE
WHERE "spaceId" IS NOT NULL
  AND "isPublic" = TRUE;

UPDATE "Session"
SET "isPrivate" = TRUE
WHERE "spaceId" IS NOT NULL
  AND "isPrivate" = FALSE;

ALTER TABLE "Template"
ADD CONSTRAINT "Template_space_public_consistency_check"
CHECK ("spaceId" IS NULL OR "isPublic" = FALSE);

ALTER TABLE "Session"
ADD CONSTRAINT "Session_space_private_consistency_check"
CHECK ("spaceId" IS NULL OR "isPrivate" = TRUE);
