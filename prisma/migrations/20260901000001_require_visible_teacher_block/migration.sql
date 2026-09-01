ALTER TABLE "RoadmapNode"
ADD CONSTRAINT "RoadmapNode_hidden_nodes_cannot_be_teacher_blocked"
CHECK ("isVisible" OR NOT "isTeacherBlocked");
