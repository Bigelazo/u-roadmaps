-- #272: every stored notice belongs to one Notice target. Notices no Notice target owns
-- start from zero (ADR-0024; precedent: ADR-0014 decision 12); nothing is converted.
-- The legacy read-side keys leave the lifecycle notices that still carry them.

DELETE FROM "RoadmapNotice" WHERE "data"->>'noticeTarget' IS NULL;

UPDATE "RoadmapNotice" SET "data" = "data" - 'changeKind' - 'changedFields' - 'targetKind'
WHERE "data" ?| ARRAY['changeKind', 'changedFields', 'targetKind'];
