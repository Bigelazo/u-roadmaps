ALTER TABLE "NodeContentKnowledge" ADD COLUMN "currentTypeName" TEXT;

CREATE OR REPLACE FUNCTION capture_node_content_knowledge() RETURNS trigger LANGUAGE plpgsql AS $$
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
      INSERT INTO "NodeContentKnowledge" ("recipientId", "nodeId", "target", "knownValue", "knownTypeName", "currentTypeName")
      SELECT p."userId", OLD."id", 'nodeType', OLD."nodeTypeId"::text, t."name", next_type."name"
      FROM "Participation" p JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
      JOIN "NodeType" t ON t."id" = OLD."nodeTypeId"
      JOIN "NodeType" next_type ON next_type."id" = NEW."nodeTypeId"
      WHERE r."id" = OLD."roadmapId" AND p."isActive"
      ON CONFLICT ("recipientId", "nodeId", "target") DO UPDATE
      SET "currentTypeName" = EXCLUDED."currentTypeName";
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
