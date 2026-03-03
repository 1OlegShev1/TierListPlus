UPDATE "Session" AS s
SET "sourceTemplateId" = NULL
WHERE "sourceTemplateId" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "Template" AS t
    WHERE t."id" = s."sourceTemplateId"
  );

CREATE INDEX "Session_sourceTemplateId_idx" ON "Session"("sourceTemplateId");

ALTER TABLE "Session"
ADD CONSTRAINT "Session_sourceTemplateId_fkey"
FOREIGN KEY ("sourceTemplateId") REFERENCES "Template"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;
