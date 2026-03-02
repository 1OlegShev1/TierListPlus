-- Collapse duplicate authenticated participants so each user has one participant per session
WITH ranked_participants AS (
    SELECT
        "id",
        "sessionId",
        "userId",
        ROW_NUMBER() OVER (
            PARTITION BY "sessionId", "userId"
            ORDER BY
                CASE WHEN "submittedAt" IS NULL THEN 1 ELSE 0 END,
                "createdAt" ASC,
                "id" ASC
        ) AS "rowNum"
    FROM "Participant"
    WHERE "userId" IS NOT NULL
),
participant_mapping AS (
    SELECT
        duplicate."id" AS "duplicateId",
        survivor."id" AS "survivorId"
    FROM ranked_participants AS duplicate
    INNER JOIN ranked_participants AS survivor
        ON survivor."sessionId" = duplicate."sessionId"
       AND survivor."userId" = duplicate."userId"
       AND survivor."rowNum" = 1
    WHERE duplicate."rowNum" > 1
),
candidate_votes AS (
    SELECT
        vote."id",
        mapping."survivorId",
        ROW_NUMBER() OVER (
            PARTITION BY mapping."survivorId", vote."sessionItemId"
            ORDER BY vote."id" ASC
        ) AS "rowNum"
    FROM "TierVote" AS vote
    INNER JOIN participant_mapping AS mapping
        ON mapping."duplicateId" = vote."participantId"
    WHERE NOT EXISTS (
        SELECT 1
        FROM "TierVote" AS existing
        WHERE existing."participantId" = mapping."survivorId"
          AND existing."sessionItemId" = vote."sessionItemId"
    )
)
UPDATE "TierVote" AS vote
SET "participantId" = candidate_votes."survivorId"
FROM candidate_votes
WHERE vote."id" = candidate_votes."id"
  AND candidate_votes."rowNum" = 1;

WITH ranked_participants AS (
    SELECT
        "id",
        "sessionId",
        "userId",
        ROW_NUMBER() OVER (
            PARTITION BY "sessionId", "userId"
            ORDER BY
                CASE WHEN "submittedAt" IS NULL THEN 1 ELSE 0 END,
                "createdAt" ASC,
                "id" ASC
        ) AS "rowNum"
    FROM "Participant"
    WHERE "userId" IS NOT NULL
),
participant_mapping AS (
    SELECT
        duplicate."id" AS "duplicateId",
        survivor."id" AS "survivorId"
    FROM ranked_participants AS duplicate
    INNER JOIN ranked_participants AS survivor
        ON survivor."sessionId" = duplicate."sessionId"
       AND survivor."userId" = duplicate."userId"
       AND survivor."rowNum" = 1
    WHERE duplicate."rowNum" > 1
),
candidate_votes AS (
    SELECT
        vote."id",
        mapping."survivorId",
        ROW_NUMBER() OVER (
            PARTITION BY mapping."survivorId", vote."matchupId"
            ORDER BY vote."id" ASC
        ) AS "rowNum"
    FROM "BracketVote" AS vote
    INNER JOIN participant_mapping AS mapping
        ON mapping."duplicateId" = vote."participantId"
    WHERE NOT EXISTS (
        SELECT 1
        FROM "BracketVote" AS existing
        WHERE existing."participantId" = mapping."survivorId"
          AND existing."matchupId" = vote."matchupId"
    )
)
UPDATE "BracketVote" AS vote
SET "participantId" = candidate_votes."survivorId"
FROM candidate_votes
WHERE vote."id" = candidate_votes."id"
  AND candidate_votes."rowNum" = 1;

WITH ranked_participants AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (
            PARTITION BY "sessionId", "userId"
            ORDER BY
                CASE WHEN "submittedAt" IS NULL THEN 1 ELSE 0 END,
                "createdAt" ASC,
                "id" ASC
        ) AS "rowNum"
    FROM "Participant"
    WHERE "userId" IS NOT NULL
)
DELETE FROM "Participant"
WHERE "id" IN (
    SELECT "id"
    FROM ranked_participants
    WHERE "rowNum" > 1
);

-- Enforce one authenticated participant per user in each session
CREATE UNIQUE INDEX "Participant_sessionId_userId_key" ON "Participant"("sessionId", "userId");
