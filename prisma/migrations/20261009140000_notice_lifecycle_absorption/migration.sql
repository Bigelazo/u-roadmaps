-- ADR-0024 (#206): Node creation, Node deletion and Roadmap availability move to the
-- notice lifecycle module, under one absorption rule over the target hierarchy.
-- Their notices, opening snapshots and lifecycle Known values start from zero (precedent:
-- ADR-0014 decision 12); nothing is converted. Roadmap no longer writes lifecycle knowledge.

DELETE FROM "RoadmapNotice"
WHERE "data"->>'noticeTarget' = 'node-creation'
   OR "data"->>'changeKind' IN ('roadmap-available', 'node-deleted');
UPDATE "NoticeAcknowledgement" SET "absorptionSnapshots" = '[]'::jsonb
WHERE "absorptionSnapshots" <> '[]';
DELETE FROM "NodeLifecycleKnowledge";
