-- Participation loss belongs to the notice lifecycle module: besides withdrawing every
-- pending notice of the Roadmap, it forgets the recipient's Known values there, so
-- regaining the Participation starts from zero against the single Known value store.
CREATE OR REPLACE FUNCTION withdraw_participation_notices() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isActive" AND NOT NEW."isActive" THEN
    NEW."noticeResetAt" := clock_timestamp();
    DELETE FROM "RoadmapNotice"
    WHERE "recipientId" = NEW."userId" AND "courseOfferingId" = NEW."courseOfferingId"
      AND "acknowledgedAt" IS NULL;
    -- An unrecognized opening must not recreate withdrawn targets after access returns.
    DELETE FROM "NoticeAcknowledgement"
    WHERE "recipientId" = NEW."userId" AND "roadmapId" IN (
      SELECT id FROM "Roadmap" WHERE "courseOfferingId" = NEW."courseOfferingId"
    );
    DELETE FROM "NoticeKnownValue"
    WHERE "recipientId" = NEW."userId" AND "roadmapId" IN (
      SELECT id FROM "Roadmap" WHERE "courseOfferingId" = NEW."courseOfferingId"
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Apply the invariant to Participations which are already inactive.
DELETE FROM "NoticeKnownValue" k USING "Participation" p, "Roadmap" r
WHERE k."recipientId" = p."userId" AND k."roadmapId" = r.id
  AND r."courseOfferingId" = p."courseOfferingId" AND NOT p."isActive";
