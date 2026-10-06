ALTER TABLE "RoadmapNotice" DROP COLUMN "seenAt";
ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "summary" JSONB NOT NULL DEFAULT 'null';

CREATE TABLE "RoadmapVisit" (
  "recipientId" UUID NOT NULL,
  "roadmapId" UUID NOT NULL,
  CONSTRAINT "RoadmapVisit_pkey" PRIMARY KEY ("recipientId", "roadmapId"),
  CONSTRAINT "RoadmapVisit_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RoadmapVisit_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
