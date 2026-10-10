-- ADR-0024 (#201): Node title moves to the notice lifecycle module, with one Known
-- value store and one opening snapshot collection. Title state starts from zero
-- (precedent: ADR-0014 decision 12); nothing is converted.
CREATE TABLE "NoticeKnownValue" (
  "recipientId" UUID NOT NULL,
  "roadmapId" UUID NOT NULL,
  "targetKey" TEXT NOT NULL,
  "nodeId" UUID,
  "knownValue" TEXT NOT NULL,
  "currentValue" TEXT,
  "context" JSONB NOT NULL DEFAULT '{}',
  CONSTRAINT "NoticeKnownValue_pkey" PRIMARY KEY ("recipientId", "roadmapId", "targetKey")
);
CREATE INDEX "NoticeKnownValue_roadmapId_nodeId_idx" ON "NoticeKnownValue"("roadmapId", "nodeId");
ALTER TABLE "NoticeKnownValue" ADD CONSTRAINT "NoticeKnownValue_recipientId_fkey"
  FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NoticeKnownValue" ADD CONSTRAINT "NoticeKnownValue_roadmapId_fkey"
  FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "snapshots" JSONB NOT NULL DEFAULT '[]';

-- The module records title baselines and recognizes titles itself.
DROP TRIGGER node_title_knowledge ON "RoadmapNode";
DROP FUNCTION capture_node_title_knowledge();
DROP TRIGGER recognize_node_title ON "RoadmapNotice";
DROP FUNCTION recognize_node_title();

DELETE FROM "RoadmapNotice" WHERE "data"->>'noticeTarget' = 'node-title';
UPDATE "NoticeAcknowledgement" SET "titleSnapshots" = '[]' WHERE "titleSnapshots" <> '[]';
-- The table itself is dropped in the contract ticket.
DELETE FROM "NodeTitleKnowledge";
