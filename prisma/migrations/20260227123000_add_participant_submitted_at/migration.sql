ALTER TABLE "Participant"
ADD COLUMN "submittedAt" TIMESTAMP(3);

UPDATE "Participant" p
SET "submittedAt" = NOW()
WHERE
  (SELECT COUNT(*) FROM "TierVote" tv WHERE tv."participantId" = p."id") > 0
  AND (SELECT COUNT(*) FROM "TierVote" tv WHERE tv."participantId" = p."id") =
      (SELECT COUNT(*) FROM "SessionItem" si WHERE si."sessionId" = p."sessionId");
