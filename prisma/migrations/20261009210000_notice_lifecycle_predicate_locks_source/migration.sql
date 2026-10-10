-- A bound `LIKE 'dependency:<node>:%'` cannot use a text_pattern_ops range in every plan,
-- so the source arm matches the key's second part exactly, like the target arm (#220).
DROP INDEX "NoticeKnownValue_dependency_source_idx";

CREATE INDEX "NoticeKnownValue_dependency_source_idx"
ON "NoticeKnownValue" ("roadmapId", split_part("targetKey", ':', 2))
WHERE "noticeTarget" = 'dependency';
