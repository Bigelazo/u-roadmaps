-- ADR-0014: activate target-based notices with a clean Inbox and clean receipts.
DELETE FROM "NoticeAcknowledgement";
DELETE FROM "NoticeDeliveryEffect";
DELETE FROM "RoadmapNotice";

ALTER TABLE "RoadmapNotice" ADD COLUMN "targetKey" TEXT;
CREATE UNIQUE INDEX "RoadmapNotice_pending_target_key"
ON "RoadmapNotice" ("recipientId", "roadmapId", "targetKey")
WHERE "acknowledgedAt" IS NULL AND "targetKey" IS NOT NULL;

CREATE TABLE "NodeTitleKnowledge" (
  "recipientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nodeId" UUID NOT NULL REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "knownTitle" VARCHAR(240) NOT NULL,
  PRIMARY KEY ("recipientId", "nodeId")
);

-- Capture the baseline in the same transaction as the rename, before deferred
-- deliveries can arrive out of order. Later mutations never overwrite knowledge.
CREATE FUNCTION capture_node_title_knowledge() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."title" IS DISTINCT FROM NEW."title" AND OLD."isVisible" THEN
    INSERT INTO "NodeTitleKnowledge" ("recipientId", "nodeId", "knownTitle")
    SELECT p."userId", OLD."id", OLD."title"
    FROM "Participation" p JOIN "Roadmap" r ON r."courseOfferingId" = p."courseOfferingId"
    WHERE r."id" = OLD."roadmapId" AND p."isActive"
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER node_title_knowledge BEFORE UPDATE OF "title" ON "RoadmapNode"
FOR EACH ROW EXECUTE FUNCTION capture_node_title_knowledge();

-- Recognition advances exactly the title in the recognized notice, not a later
-- Node title whose delivery the recipient has not yet recognized.
CREATE FUNCTION recognize_node_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."acknowledgedAt" IS NULL AND NEW."acknowledgedAt" IS NOT NULL
     AND NEW."targetKey" IS NOT NULL THEN
    UPDATE "NodeTitleKnowledge" SET "knownTitle" = NEW."data"->>'currentTitle'
    WHERE "recipientId" = NEW."recipientId" AND "nodeId" = (NEW."data"->>'nodeId')::uuid;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER recognize_node_title AFTER UPDATE OF "acknowledgedAt" ON "RoadmapNotice"
FOR EACH ROW EXECUTE FUNCTION recognize_node_title();

CREATE OR REPLACE FUNCTION notify_own_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('u_roadmaps_changes', json_build_object(
    'kind', 'inbox', 'userId', CASE WHEN TG_OP = 'DELETE' THEN OLD."recipientId" ELSE NEW."recipientId" END
  )::text);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
DROP TRIGGER own_inbox_changed ON "RoadmapNotice";
CREATE TRIGGER own_inbox_changed AFTER INSERT OR UPDATE OR DELETE ON "RoadmapNotice"
FOR EACH ROW EXECUTE FUNCTION notify_own_inbox();
