-- Historical timestamp snapshots cannot reconstruct previous content. Upgrade
-- only snapshots that still identify the current version; retain other opaque
-- revisions until the next recognition rather than silently acknowledging edits.
CREATE FUNCTION resource_content_revision(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value IS NULL THEN 'n' ELSE 's' || octet_length(value)::text || ':' || value END;
$$;

CREATE FUNCTION upgrade_resource_snapshot(value jsonb, resource_id text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql AS $$
DECLARE
  result jsonb;
  entry record;
  current_resource "Resource"%ROWTYPE;
  candidate_id text;
BEGIN
  IF jsonb_typeof(value) = 'array' THEN
    SELECT COALESCE(jsonb_agg(upgrade_resource_snapshot(element, resource_id)), '[]'::jsonb)
      INTO result FROM jsonb_array_elements(value) element;
    RETURN result;
  END IF;
  IF jsonb_typeof(value) <> 'object' THEN RETURN value; END IF;
  candidate_id := COALESCE(value->>'resourceId', resource_id);
  IF value ? 'title' AND value ? 'revision' THEN
    candidate_id := COALESCE(value->>'id', candidate_id);
    SELECT * INTO current_resource FROM "Resource" WHERE id::text = candidate_id;
    IF FOUND AND value->>'title' = current_resource.title
      AND value->>'revision' = to_char(current_resource."updatedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') THEN
      value := jsonb_set(value, '{revision}', to_jsonb('content-v1:' || encode(sha256(convert_to(
        resource_content_revision(current_resource.title) ||
        resource_content_revision(current_resource.url) ||
        resource_content_revision(current_resource.type::text) ||
        resource_content_revision(current_resource."fileKey"::text) ||
        resource_content_revision(current_resource."fileContentType"), 'UTF8')), 'hex')));
    END IF;
  END IF;
  result := '{}'::jsonb;
  FOR entry IN SELECT * FROM jsonb_each(value) LOOP
    result := result || jsonb_build_object(entry.key, upgrade_resource_snapshot(entry.value, candidate_id));
  END LOOP;
  RETURN result;
END;
$$;

UPDATE "ResourceNoticeKnowledge"
SET "knownState" = upgrade_resource_snapshot("knownState"::jsonb, "resourceId"::text)::text
WHERE "knownState" IS NOT NULL;
UPDATE "RoadmapNotice" SET data = upgrade_resource_snapshot(data);
UPDATE "NoticeAcknowledgement" SET
  "resourceSnapshots" = upgrade_resource_snapshot("resourceSnapshots"),
  "absorptionSnapshots" = upgrade_resource_snapshot("absorptionSnapshots");

DROP FUNCTION upgrade_resource_snapshot(jsonb, text);
DROP FUNCTION resource_content_revision(text);
