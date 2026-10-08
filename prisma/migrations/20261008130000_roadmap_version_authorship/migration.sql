-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN "creatorId" UUID;

-- CreateTable
CREATE TABLE "RoadmapClosureTeachingStaff" (
    "roadmapId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "institutionalPosition" "InstitutionalCoursePosition",

    CONSTRAINT "RoadmapClosureTeachingStaff_pkey" PRIMARY KEY ("roadmapId","userId")
);

-- CreateIndex
CREATE INDEX "RoadmapClosureTeachingStaff_userId_idx" ON "RoadmapClosureTeachingStaff"("userId");

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapClosureTeachingStaff" ADD CONSTRAINT "RoadmapClosureTeachingStaff_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoadmapClosureTeachingStaff" ADD CONSTRAINT "RoadmapClosureTeachingStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
