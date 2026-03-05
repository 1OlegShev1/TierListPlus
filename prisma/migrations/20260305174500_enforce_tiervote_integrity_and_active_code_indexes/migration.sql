-- Fail fast if historical data violates the invariant we are about to enforce.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "TierVote" tv
    JOIN "Participant" p ON p."id" = tv."participantId"
    JOIN "SessionItem" si ON si."id" = tv."sessionItemId"
    WHERE p."sessionId" <> si."sessionId"
  ) THEN
    RAISE EXCEPTION 'Cannot enforce TierVote session integrity: rows exist where participant/sessionItem session mismatch';
  END IF;
END
$$;

-- Enforce that a vote can only connect a participant and item from the same session.
CREATE OR REPLACE FUNCTION public.enforce_tiervote_same_session()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  participant_session_id text;
  item_session_id text;
BEGIN
  SELECT p."sessionId" INTO participant_session_id
  FROM "Participant" p
  WHERE p."id" = NEW."participantId";

  SELECT si."sessionId" INTO item_session_id
  FROM "SessionItem" si
  WHERE si."id" = NEW."sessionItemId";

  IF participant_session_id IS NULL OR item_session_id IS NULL THEN
    -- Let foreign keys raise canonical errors for missing rows.
    RETURN NEW;
  END IF;

  IF participant_session_id <> item_session_id THEN
    RAISE EXCEPTION
      USING
        ERRCODE = '23514',
        MESSAGE = 'TierVote participantId and sessionItemId must belong to the same session';
  END IF;

  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS tiervote_same_session_check ON "TierVote";

CREATE TRIGGER tiervote_same_session_check
BEFORE INSERT OR UPDATE OF "participantId", "sessionItemId"
ON "TierVote"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_tiervote_same_session();

-- Speed up "active code" lookups used by recovery/device management.
CREATE INDEX "LinkCode_userId_expiresAt_createdAt_active_idx"
ON "LinkCode" ("userId", "expiresAt", "createdAt" DESC)
WHERE "consumedAt" IS NULL;

-- Speed up active private-space invite lookup/rotation queries.
CREATE INDEX "SpaceInvite_spaceId_expiresAt_createdAt_active_idx"
ON "SpaceInvite" ("spaceId", "expiresAt", "createdAt" DESC)
WHERE "revokedAt" IS NULL;
