-- ADR-0024 (#203): Node access moves to the notice lifecycle module.
-- Access notices, their opening snapshots and Known values start from zero (precedent:
-- ADR-0014 decision 12); nothing is converted. Roadmap no longer writes access baselines.

DELETE FROM "RoadmapNotice" WHERE "data"->>'noticeTarget' = 'node-access';
-- Access was the last target captured in this column.
UPDATE "NoticeAcknowledgement" SET "contentSnapshots" = '[]'::jsonb
WHERE "contentSnapshots" <> '[]';
DELETE FROM "NodeContentKnowledge" WHERE "target" = 'access';
