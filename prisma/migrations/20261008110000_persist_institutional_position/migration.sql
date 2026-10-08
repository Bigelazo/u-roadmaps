-- A local prototype may already contain the four teaching positions.
DO $$ BEGIN
  CREATE TYPE "InstitutionalCoursePosition" AS ENUM ('COURSE_PROFESSOR', 'COORDINATING_PROFESSOR', 'AUXILIARY_PROFESSOR', 'TEACHING_ASSISTANT', 'STUDENT', 'OBSERVER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TYPE "InstitutionalCoursePosition" ADD VALUE IF NOT EXISTS 'STUDENT';
ALTER TYPE "InstitutionalCoursePosition" ADD VALUE IF NOT EXISTS 'OBSERVER';
ALTER TABLE "Participation" ADD COLUMN IF NOT EXISTS "institutionalPosition" "InstitutionalCoursePosition";
