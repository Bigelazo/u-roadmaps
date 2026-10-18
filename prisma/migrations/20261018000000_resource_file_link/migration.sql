-- Technical ownership normalization is silent. Keep the old payload until every
-- provable Known value and opening capture has been translated (ADR-0032).
BEGIN;

CREATE FUNCTION pg_temp.resource_revision_field(value text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN value IS NULL THEN 'n' ELSE 's' || octet_length(value)::text || ':' || value END;
$$;

CREATE FUNCTION pg_temp.resource_revision(title text, url text, kind text, file_key text, content_type text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'content-v1:' || encode(sha256(convert_to(
    pg_temp.resource_revision_field(title) || pg_temp.resource_revision_field(url) ||
    pg_temp.resource_revision_field(kind) || pg_temp.resource_revision_field(file_key) ||
    pg_temp.resource_revision_field(content_type), 'UTF8')), 'hex');
$$;

CREATE FUNCTION pg_temp.normalize_resource_value(value text, target_key text)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  state jsonb;
  resource "Resource"%ROWTYPE;
  old_kind text;
  revision text;
BEGIN
  IF value IS NULL OR target_key NOT LIKE 'resource:%' THEN RETURN value; END IF;
  state := value::jsonb;
  IF jsonb_typeof(state) <> 'object' OR jsonb_typeof(state->'title') <> 'string'
    OR jsonb_typeof(state->'revision') <> 'string' THEN RETURN value; END IF;
  SELECT * INTO resource FROM "Resource" WHERE id::text = substring(target_key FROM 10);
  IF NOT FOUND THEN RETURN value; END IF;
  -- Use the retained state's title, not today's title. Previous URL/file payloads
  -- cannot be guessed: unmatched hashes, including deleted Resources, stay opaque.
  FOREACH old_kind IN ARRAY ARRAY['FILE', 'LINK', 'VIDEO'] LOOP
    IF state->>'revision' = pg_temp.resource_revision(state->>'title', resource.url,
      old_kind, resource."fileKey"::text, resource."fileContentType") THEN
      revision := pg_temp.resource_revision(state->>'title', resource.url,
        CASE WHEN resource."fileKey" IS NULL THEN 'LINK' ELSE 'FILE' END,
        resource."fileKey"::text,
        CASE WHEN resource."fileKey" IS NULL THEN NULL ELSE resource."fileContentType" END);
      -- jsonb::text adds spaces/reorders keys. Exact encoded-string equality uses
      -- JSON.stringify({title,revision}) order; to_json(text) supplies its escaping.
      RETURN '{"title":' || to_json(state->>'title')::text ||
        ',"revision":' || to_json(revision)::text || '}';
    END IF;
  END LOOP;
  RETURN value;
END;
$$;

CREATE FUNCTION pg_temp.normalize_resource_target(value jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  field text;
BEGIN
  IF value->>'noticeTarget' IS DISTINCT FROM 'resource' THEN RETURN value; END IF;
  FOREACH field IN ARRAY ARRAY['knownValue', 'currentValue'] LOOP
    IF jsonb_typeof(value->field) = 'string' THEN
      value := jsonb_set(value, ARRAY[field], to_jsonb(
        pg_temp.normalize_resource_value(value->>field, value->>'targetKey')));
    END IF;
  END LOOP;
  RETURN value;
END;
$$;

UPDATE "NoticeKnownValue" SET
  "knownValue" = pg_temp.normalize_resource_value("knownValue", "targetKey"),
  "currentValue" = pg_temp.normalize_resource_value("currentValue", "targetKey")
WHERE "noticeTarget" = 'resource';

UPDATE "RoadmapNotice" SET data = pg_temp.normalize_resource_target(data)
WHERE data->>'noticeTarget' = 'resource';

-- WITH ORDINALITY makes the captured order explicit; other targets, flags, cached
-- summary text and recognized history are left intact. Empty arrays stay empty.
UPDATE "NoticeAcknowledgement" acknowledgement SET snapshots = (
  SELECT COALESCE(jsonb_agg(pg_temp.normalize_resource_target(entry) ORDER BY position), '[]'::jsonb)
  FROM jsonb_array_elements(acknowledgement.snapshots) WITH ORDINALITY AS entries(entry, position)
);

DELETE FROM "RoadmapNotice"
WHERE "acknowledgedAt" IS NULL AND data->>'noticeTarget' = 'resource'
  AND jsonb_typeof(data->'knownValue') = 'string'
  AND jsonb_typeof(data->'currentValue') = 'string'
  AND data->>'knownValue' = data->>'currentValue';

-- Actual ownership wins over anomalous old labels. No URLs or bytes are fetched,
-- discarded, or rewritten; raw SQL preserves original updatedAt timestamps.
UPDATE "Resource" SET
  type = CASE WHEN "fileKey" IS NULL THEN 'LINK'::"ResourceType" ELSE 'FILE'::"ResourceType" END,
  "fileContentType" = CASE WHEN "fileKey" IS NULL THEN NULL ELSE "fileContentType" END;

ALTER TYPE "ResourceType" RENAME TO "ResourceType_old";
CREATE TYPE "ResourceType" AS ENUM ('FILE', 'LINK');
ALTER TABLE "Resource" ALTER COLUMN type TYPE "ResourceType" USING type::text::"ResourceType";
DROP TYPE "ResourceType_old";
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_file_ownership_check" CHECK (
  (type = 'FILE' AND "fileKey" IS NOT NULL) OR
  (type = 'LINK' AND "fileKey" IS NULL AND "fileContentType" IS NULL)
);

DROP FUNCTION pg_temp.normalize_resource_target(jsonb);
DROP FUNCTION pg_temp.normalize_resource_value(text, text);
DROP FUNCTION pg_temp.resource_revision(text, text, text, text, text);
DROP FUNCTION pg_temp.resource_revision_field(text);
COMMIT;
