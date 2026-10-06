ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "contentSnapshots" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "NodeContentKnowledge" (
  "recipientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nodeId" UUID NOT NULL REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "target" TEXT NOT NULL,
  "knownValue" TEXT NOT NULL,
  "knownTypeName" TEXT,
  PRIMARY KEY ("recipientId", "nodeId", "target")
);

CREATE FUNCTION capture_node_content_knowledge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isVisible" THEN
    IF OLD."description" IS DISTINCT FROM NEW."description" THEN
      INSERT INTO "NodeContentKnowledge" ("recipientId", "nodeId", "target", "knownValue")
      SELECT p."userId", OLD."id", 'description', COALESCE(to_jsonb(OLD."description"), 'null'::jsonb)::text
      FROM "Participation" p JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
      WHERE r."id" = OLD."roadmapId" AND p."isActive"
      ON CONFLICT DO NOTHING;
    END IF;
    IF OLD."nodeTypeId" IS DISTINCT FROM NEW."nodeTypeId" THEN
      INSERT INTO "NodeContentKnowledge" ("recipientId", "nodeId", "target", "knownValue", "knownTypeName")
      SELECT p."userId", OLD."id", 'nodeType', OLD."nodeTypeId"::text, t."name"
      FROM "Participation" p JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
      JOIN "NodeType" t ON t."id" = OLD."nodeTypeId"
      WHERE r."id" = OLD."roadmapId" AND p."isActive"
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER node_content_knowledge BEFORE UPDATE OF "description", "nodeTypeId" ON "RoadmapNode"
FOR EACH ROW EXECUTE FUNCTION capture_node_content_knowledge();

-- Only title targets advance title knowledge; other target acknowledgements must
-- never overwrite it with their unrelated values.
CREATE OR REPLACE FUNCTION recognize_node_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."acknowledgedAt" IS NULL AND NEW."acknowledgedAt" IS NOT NULL
     AND NEW."data"->>'noticeTarget' = 'node-title' THEN
    UPDATE "NodeTitleKnowledge" SET "knownTitle" = NEW."data"->>'currentTitle'
    WHERE "recipientId" = NEW."recipientId" AND "nodeId" = (NEW."data"->>'nodeId')::uuid;
  END IF;
  RETURN NEW;
END;
$$;
