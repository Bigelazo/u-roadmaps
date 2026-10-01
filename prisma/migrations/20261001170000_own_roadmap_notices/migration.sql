CREATE TABLE "RoadmapNotice" (
  "id" UUID NOT NULL,
  "eventId" TEXT NOT NULL,
  "recipientId" UUID NOT NULL,
  "roadmapId" UUID NOT NULL,
  "courseOfferingId" UUID NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "seenAt" TIMESTAMP(3),
  "acknowledgedAt" TIMESTAMP(3),
  CONSTRAINT "RoadmapNotice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RoadmapNotice_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "RoadmapNotice_eventId_recipientId_key" ON "RoadmapNotice"("eventId", "recipientId");
CREATE INDEX "RoadmapNotice_recipientId_availableAt_id_idx" ON "RoadmapNotice"("recipientId", "availableAt", "id");
CREATE INDEX "RoadmapNotice_recipientId_roadmapId_acknowledgedAt_idx" ON "RoadmapNotice"("recipientId", "roadmapId", "acknowledgedAt");
