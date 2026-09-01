DELETE FROM "Dependency" AS dependency
USING "RoadmapNode" AS source_node, "RoadmapNode" AS target_node
WHERE dependency."sourceNodeId" = source_node."id"
  AND dependency."targetNodeId" = target_node."id"
  AND (NOT source_node."isVisible" OR NOT target_node."isVisible");
