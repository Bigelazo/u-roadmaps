-- A Dependency pair's value says whether the requirement exists as `present`/`absent`
-- (like Resources and broad targets) instead of the strings `true`/`false`.

UPDATE "NoticeKnownValue" SET
  "knownValue" = CASE "knownValue" WHEN 'true' THEN 'present' WHEN 'false' THEN 'absent' ELSE "knownValue" END,
  "currentValue" = CASE "currentValue" WHEN 'true' THEN 'present' WHEN 'false' THEN 'absent' ELSE "currentValue" END
WHERE "noticeTarget" = 'dependency';

UPDATE "RoadmapNotice" SET "data" = "data"
  || jsonb_build_object('knownValue', CASE "data"->>'knownValue' WHEN 'true' THEN 'present' WHEN 'false' THEN 'absent' ELSE "data"->>'knownValue' END)
  || jsonb_build_object('currentValue', CASE "data"->>'currentValue' WHEN 'true' THEN 'present' WHEN 'false' THEN 'absent' ELSE "data"->>'currentValue' END)
WHERE "data"->>'noticeTarget' = 'dependency'
  AND "data" ? 'knownValue' AND "data" ? 'currentValue';

-- Entry snapshots awaiting recognition carry the value entry showed.
UPDATE "NoticeAcknowledgement" SET "snapshots" = (
  SELECT jsonb_agg(
    CASE WHEN snapshot->>'noticeTarget' = 'dependency' AND snapshot ? 'currentValue'
      THEN snapshot || jsonb_build_object('currentValue',
        CASE snapshot->>'currentValue' WHEN 'true' THEN 'present' WHEN 'false' THEN 'absent' ELSE snapshot->>'currentValue' END)
      ELSE snapshot END
    ORDER BY position)
  FROM jsonb_array_elements("snapshots") WITH ORDINALITY AS element(snapshot, position)
)
WHERE jsonb_typeof("snapshots") = 'array'
  AND EXISTS (
    SELECT 1 FROM jsonb_array_elements("snapshots") AS element(snapshot)
    WHERE snapshot->>'noticeTarget' = 'dependency'
  );
