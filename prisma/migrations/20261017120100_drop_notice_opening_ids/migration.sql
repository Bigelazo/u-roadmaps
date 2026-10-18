-- #272: Roadmap entry recognizes only the Notice targets it captured (`snapshots`); the ids
-- of the target-less notices an opening captured are no longer kept.
ALTER TABLE "NoticeAcknowledgement" DROP COLUMN "noticeIds";
