ALTER TABLE "RoadmapNode"
DROP CONSTRAINT "RoadmapNode_teacher_unlock_date_requires_teacher_block";

DROP INDEX "RoadmapNode_teacherUnlockOn_idx";

ALTER TABLE "RoadmapNode"
RENAME COLUMN "teacherUnlockOn" TO "teacherUnlockAt";

ALTER TABLE "RoadmapNode"
ALTER COLUMN "teacherUnlockAt" TYPE TIMESTAMPTZ(3)
USING ("teacherUnlockAt"::timestamp AT TIME ZONE 'America/Santiago');

ALTER TABLE "RoadmapNode"
ADD CONSTRAINT "RoadmapNode_teacher_unlock_requires_teacher_block"
CHECK ("teacherUnlockAt" IS NULL OR "isTeacherBlocked");

CREATE INDEX "RoadmapNode_teacherUnlockAt_idx" ON "RoadmapNode"("teacherUnlockAt");
