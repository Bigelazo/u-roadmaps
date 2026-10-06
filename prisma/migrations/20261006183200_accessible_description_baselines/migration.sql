-- Description baselines are captured with projected recipient access in the
-- serializable Node edit transaction. The trigger retains visible type capture.
CREATE OR REPLACE FUNCTION capture_node_content_knowledge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."isVisible" THEN
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
