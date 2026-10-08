-- ADR-0024 (#205): the Dependency pair and Node type name Notice targets move to the
-- notice lifecycle module (NoticeKnownValue and NoticeAcknowledgement.snapshots).
-- Route state starts from zero (precedent: ADR-0014 decision 12); nothing is converted.
DELETE FROM "RoadmapNotice"
WHERE "data"->>'noticeTarget' IN ('dependency', 'node-type-name')
   OR "data"->>'noticeClass' IN ('roadmap-path-changed', 'roadmap-classification-changed');
UPDATE "NoticeAcknowledgement" SET "routeSnapshots" = '[]' WHERE "routeSnapshots" <> '[]';
-- The table and the column are dropped in the contract ticket.
DELETE FROM "RouteNoticeKnowledge";
