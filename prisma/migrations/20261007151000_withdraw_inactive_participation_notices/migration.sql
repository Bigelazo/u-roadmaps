-- Remember the last loss so an already scheduled delivery cannot return after reactivation.
ALTER TABLE "Participation" ADD COLUMN "noticeResetAt" TIMESTAMPTZ(3);

CREATE FUNCTION withdraw_participation_notices() RETURNS trigger LANGUAGE plpgsql AS $$
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
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER participation_notices_withdrawn BEFORE UPDATE OF "isActive" ON "Participation"
FOR EACH ROW EXECUTE FUNCTION withdraw_participation_notices();

-- Apply the invariant to Participations which were already inactive before deployment.
DELETE FROM "RoadmapNotice" n USING "Participation" p
WHERE n."recipientId" = p."userId" AND n."courseOfferingId" = p."courseOfferingId"
  AND NOT p."isActive" AND n."acknowledgedAt" IS NULL;
DELETE FROM "NoticeAcknowledgement" a USING "Participation" p, "Roadmap" r
WHERE a."recipientId" = p."userId" AND a."roadmapId" = r.id
  AND r."courseOfferingId" = p."courseOfferingId" AND NOT p."isActive";
UPDATE "Participation" SET "noticeResetAt" = clock_timestamp() WHERE NOT "isActive";
