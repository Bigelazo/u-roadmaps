-- Transactional invalidations only: PostgreSQL delivers NOTIFY after commit.
-- No pedagogical content or replay log travels through this channel.
CREATE FUNCTION notify_own_inbox() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('u_roadmaps_changes', json_build_object(
    'kind', 'inbox', 'userId', NEW."recipientId"
  )::text);
  RETURN NEW;
END;
$$;
CREATE TRIGGER own_inbox_changed AFTER INSERT OR UPDATE ON "RoadmapNotice"
FOR EACH ROW EXECUTE FUNCTION notify_own_inbox();

CREATE FUNCTION notify_roadmap_projection() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  row_data jsonb;
  roadmap_id uuid;
  offering_id uuid;
  offering record;
BEGIN
  IF TG_OP = 'DELETE' THEN row_data := to_jsonb(OLD);
  ELSE row_data := to_jsonb(NEW); END IF;
  IF TG_TABLE_NAME = 'Participation' OR TG_TABLE_NAME = 'Roadmap' THEN
    offering_id := (row_data->>'courseOfferingId')::uuid;
  ELSE
    roadmap_id := (row_data->>'roadmapId')::uuid;
    IF roadmap_id IS NULL THEN
      SELECT "roadmapId" INTO roadmap_id FROM "RoadmapNode"
      WHERE id = COALESCE(row_data->>'roadmapNodeId', row_data->>'sourceNodeId')::uuid;
    END IF;
    SELECT "courseOfferingId" INTO offering_id FROM "Roadmap" WHERE id = roadmap_id;
  END IF;
  SELECT "courseCode", year, semester INTO offering FROM "CourseOffering" WHERE id = offering_id;
  IF FOUND THEN
    PERFORM pg_notify('u_roadmaps_changes', json_build_object(
      'kind', 'roadmap', 'courseOfferingId', offering_id,
      'courseCode', offering."courseCode", 'year', offering.year, 'semester', offering.semester,
      'userId', CASE WHEN TG_TABLE_NAME IN ('Participation', 'Completion') THEN row_data->>'userId' ELSE NULL END
    )::text);
  END IF;
  RETURN NULL;
END;
$$;
CREATE TRIGGER roadmap_node_changed AFTER INSERT OR UPDATE OR DELETE ON "RoadmapNode"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_dependency_changed AFTER INSERT OR UPDATE OR DELETE ON "Dependency"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_resource_changed AFTER INSERT OR UPDATE OR DELETE ON "Resource"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_type_changed AFTER INSERT OR UPDATE OR DELETE ON "NodeType"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_changed AFTER INSERT OR UPDATE OR DELETE ON "Roadmap"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_participation_changed AFTER INSERT OR UPDATE OR DELETE ON "Participation"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
CREATE TRIGGER roadmap_completion_changed AFTER INSERT OR UPDATE OR DELETE ON "Completion"
FOR EACH ROW EXECUTE FUNCTION notify_roadmap_projection();
