-- Openings receive an order while holding the recipient/Roadmap lock. Unlike
-- millisecond timestamps, this sequence distinguishes simultaneous tab entries.
CREATE SEQUENCE "NoticeAcknowledgement_openingSequence_seq";
ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "openingSequence" BIGINT;
WITH ordered AS (
  SELECT "recipientId", "operationId",
    row_number() OVER (ORDER BY "openedAt", "operationId", "recipientId") AS sequence
  FROM "NoticeAcknowledgement"
)
UPDATE "NoticeAcknowledgement" acknowledgement
SET "openingSequence" = ordered.sequence
FROM ordered
WHERE acknowledgement."recipientId" = ordered."recipientId"
  AND acknowledgement."operationId" = ordered."operationId";
SELECT setval('"NoticeAcknowledgement_openingSequence_seq"',
  coalesce((SELECT max("openingSequence") FROM "NoticeAcknowledgement"), 0) + 1, false);
ALTER TABLE "NoticeAcknowledgement"
  ALTER COLUMN "openingSequence" SET NOT NULL,
  ALTER COLUMN "openingSequence" SET DEFAULT nextval('"NoticeAcknowledgement_openingSequence_seq"');
ALTER SEQUENCE "NoticeAcknowledgement_openingSequence_seq"
  OWNED BY "NoticeAcknowledgement"."openingSequence";

-- The watermark must survive pruning the 24-hour opening receipts.
ALTER TABLE "RoadmapVisit" ADD COLUMN "lastRecognizedOpeningSequence" BIGINT NOT NULL DEFAULT 0;
UPDATE "RoadmapVisit" visit
SET "lastRecognizedOpeningSequence" = recognized.sequence
FROM (
  SELECT "recipientId", "roadmapId", max("openingSequence") AS sequence
  FROM "NoticeAcknowledgement"
  WHERE "recognizedAt" IS NOT NULL
  GROUP BY "recipientId", "roadmapId"
) recognized
WHERE visit."recipientId" = recognized."recipientId"
  AND visit."roadmapId" = recognized."roadmapId";
