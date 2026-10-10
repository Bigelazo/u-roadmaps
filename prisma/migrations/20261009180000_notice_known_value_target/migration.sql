-- Each Known value names the Notice target kind that owns its key, so readers select
-- the descriptor by kind instead of parsing the key's shape.
ALTER TABLE "NoticeKnownValue" ADD COLUMN "noticeTarget" TEXT;

UPDATE "NoticeKnownValue" SET "noticeTarget" = CASE
  WHEN "targetKey" LIKE 'roadmap:%:availability' THEN 'roadmap-availability'
  WHEN "targetKey" LIKE 'resource:%' THEN 'resource'
  WHEN "targetKey" LIKE 'dependency:%' THEN 'dependency'
  WHEN "targetKey" LIKE 'node-type:%' THEN 'node-type-name'
  WHEN "targetKey" LIKE 'node:%:title' THEN 'node-title'
  WHEN "targetKey" LIKE 'node:%:description' THEN 'node-description'
  WHEN "targetKey" LIKE 'node:%:nodeType' THEN 'node-type'
  WHEN "targetKey" LIKE 'node:%:access' THEN 'node-access'
  WHEN "targetKey" LIKE 'node:%:creation' THEN 'node-creation'
END;

-- A key no descriptor owns has nothing to compare against.
DELETE FROM "NoticeKnownValue" WHERE "noticeTarget" IS NULL;

ALTER TABLE "NoticeKnownValue" ALTER COLUMN "noticeTarget" SET NOT NULL;
