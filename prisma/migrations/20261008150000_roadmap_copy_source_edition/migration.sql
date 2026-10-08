-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN "sourceYear" INTEGER,
ADD COLUMN "sourceSemester" INTEGER;

-- Record the edition of every existing copy, so its origin survives removing the source.
UPDATE "Roadmap" AS copy
SET "sourceYear" = offering."year", "sourceSemester" = offering."semester"
FROM "Roadmap" AS source
JOIN "CourseOffering" AS offering ON offering."id" = source."courseOfferingId"
WHERE copy."sourceRoadmapId" = source."id";

-- A recorded source edition always has both parts.
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_source_edition_check"
  CHECK (("sourceYear" IS NULL) = ("sourceSemester" IS NULL));
