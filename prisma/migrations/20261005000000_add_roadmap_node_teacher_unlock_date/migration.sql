ALTER TABLE "RoadmapNode"
ADD COLUMN "teacherUnlockOn" DATE;

ALTER TABLE "RoadmapNode"
ADD CONSTRAINT "RoadmapNode_teacher_unlock_date_requires_teacher_block"
CHECK ("teacherUnlockOn" IS NULL OR "isTeacherBlocked");

CREATE INDEX "RoadmapNode_teacherUnlockOn_idx" ON "RoadmapNode"("teacherUnlockOn");
