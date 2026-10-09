-- ADR-0024 contract step (#209): the notice lifecycle module keeps every Known value in
-- "NoticeKnownValue" and every opening capture in "NoticeAcknowledgement".snapshots, so
-- the per-kind Known value tables and per-kind snapshot columns are no longer read.
ALTER TABLE "NoticeAcknowledgement"
  DROP COLUMN "contentSnapshots",
  DROP COLUMN "titleSnapshots",
  DROP COLUMN "resourceSnapshots",
  DROP COLUMN "routeSnapshots",
  DROP COLUMN "absorptionSnapshots";

DROP TABLE "NodeTitleKnowledge";
DROP TABLE "NodeContentKnowledge";
DROP TABLE "NodeLifecycleKnowledge";
DROP TABLE "ResourceNoticeKnowledge";
DROP TABLE "RouteNoticeKnowledge";

-- Story 52: Node deletion forgets the Node's Known values. Rows left behind by earlier
-- deletions (unrecognized creations of Nodes that no longer exist) are removed here.
DELETE FROM "NoticeKnownValue" k
WHERE k."nodeId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "RoadmapNode" n WHERE n.id = k."nodeId");
