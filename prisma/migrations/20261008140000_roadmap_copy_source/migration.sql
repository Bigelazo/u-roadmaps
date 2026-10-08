-- AlterTable
ALTER TABLE "Roadmap" ADD COLUMN "sourceRoadmapId" UUID;

-- CreateIndex
CREATE INDEX "Roadmap_sourceRoadmapId_idx" ON "Roadmap"("sourceRoadmapId");

-- AddForeignKey
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_sourceRoadmapId_fkey" FOREIGN KEY ("sourceRoadmapId") REFERENCES "Roadmap"("id") ON DELETE SET NULL ON UPDATE CASCADE;
