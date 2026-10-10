-- Index ranges for the statements a serializable Roadmap edit runs when a Node is
-- deleted. Each deletes exactly the rows its range reads, so PostgreSQL keeps no
-- per-row predicate locks and none are promoted to a table lock (#220).
-- Raw SQL only: Prisma cannot express partial or expression indexes.
DROP INDEX "NoticeKnownValue_roadmapId_targetKey_idx";

-- Dependency pairs naming the Node first: `dependency:<node>:%`.
CREATE INDEX "NoticeKnownValue_dependency_source_idx"
ON "NoticeKnownValue" ("roadmapId", "targetKey" text_pattern_ops)
WHERE "noticeTarget" = 'dependency';

-- Dependency pairs naming the Node second: `dependency:%:<node>`.
CREATE INDEX "NoticeKnownValue_dependency_target_idx"
ON "NoticeKnownValue" ("roadmapId", split_part("targetKey", ':', 3))
WHERE "noticeTarget" = 'dependency';

-- Pending creation notices of the deleted Node, across recipients.
CREATE INDEX "RoadmapNotice_pending_roadmap_target_idx"
ON "RoadmapNotice" ("roadmapId", "targetKey")
WHERE "acknowledgedAt" IS NULL;
