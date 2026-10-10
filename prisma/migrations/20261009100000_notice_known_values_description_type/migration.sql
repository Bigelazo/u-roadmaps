-- ADR-0024 (#202): Node description and Node type move to the notice lifecycle module.
-- Their notices, opening snapshots and Known values start from zero (precedent:
-- ADR-0014 decision 12); nothing is converted. Access stays on the old stack.

-- The module records type baselines (with the type names as Known value context).
DROP TRIGGER node_content_knowledge ON "RoadmapNode";
DROP FUNCTION capture_node_content_knowledge();

DELETE FROM "RoadmapNotice" WHERE "data"->>'noticeTarget' IN ('node-description', 'node-type');
UPDATE "NoticeAcknowledgement" SET "contentSnapshots" = COALESCE((
  SELECT jsonb_agg(snapshot.value ORDER BY snapshot.position)
  FROM jsonb_array_elements("contentSnapshots") WITH ORDINALITY AS snapshot(value, position)
  WHERE snapshot.value->'payload'->>'contentTarget' = 'access'
), '[]'::jsonb)
WHERE "contentSnapshots" <> '[]';
DELETE FROM "NodeContentKnowledge" WHERE "target" IN ('description', 'nodeType');
