-- Index ranges for the statements a serializable Roadmap edit runs when a Node is
-- deleted. Each deletes exactly the rows its range reads, so PostgreSQL keeps no
-- per-row predicate locks and none are promoted to a table lock (#220).
-- Raw SQL only: Prisma cannot express partial or expression indexes (see the comments on
-- the models in schema.prisma).
--
-- Idempotent: it replaces three earlier drafts that some development and test databases
-- already applied (`20261009210000_notice_known_value_target_index`,
-- `…_notice_lifecycle_predicate_locks` and `…_source`).
DROP INDEX IF EXISTS "NoticeKnownValue_roadmapId_targetKey_idx";
-- A draft built the source index on text_pattern_ops; rebuild it on the expression below.
DROP INDEX IF EXISTS "NoticeKnownValue_dependency_source_idx";

-- Dependency pairs `dependency:<source>:<target>`, by either Node. The expressions and the
-- predicate must stay exactly those of `dependencyKeyNode` and `dependencyIndexPredicate`
-- (notice-lifecycle/known-values.ts); `dependency-key-indexes.test.ts` checks the plans.
CREATE INDEX IF NOT EXISTS "NoticeKnownValue_dependency_source_idx"
ON "NoticeKnownValue" ("roadmapId", split_part("targetKey", ':', 2))
WHERE "noticeTarget" = 'dependency';

CREATE INDEX IF NOT EXISTS "NoticeKnownValue_dependency_target_idx"
ON "NoticeKnownValue" ("roadmapId", split_part("targetKey", ':', 3))
WHERE "noticeTarget" = 'dependency';

-- Pending creation notices of the deleted Node, across recipients.
CREATE INDEX IF NOT EXISTS "RoadmapNotice_pending_roadmap_target_idx"
ON "RoadmapNotice" ("roadmapId", "targetKey")
WHERE "acknowledgedAt" IS NULL;
