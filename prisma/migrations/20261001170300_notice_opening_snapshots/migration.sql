ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "noticeIds" UUID[] NOT NULL DEFAULT ARRAY[]::UUID[];
