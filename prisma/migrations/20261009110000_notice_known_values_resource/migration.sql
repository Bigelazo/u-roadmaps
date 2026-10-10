-- ADR-0024 (#204): the Resource Notice target moves to the notice lifecycle module.
-- Its Known values live in NoticeKnownValue (`resource:<id>`) and its pending
-- notices are captured in NoticeAcknowledgement.snapshots. Resource state starts
-- from zero (precedent: ADR-0014 decision 12); nothing is converted.
DELETE FROM "RoadmapNotice" WHERE "data"->>'noticeTarget' = 'resource';
UPDATE "NoticeAcknowledgement" SET "resourceSnapshots" = '[]' WHERE "resourceSnapshots" <> '[]';
-- The table itself is dropped in the contract ticket.
DELETE FROM "ResourceNoticeKnowledge";
