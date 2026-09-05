-- A simulated completion is deliberately scoped by all three ownership boundaries.
-- The composite foreign keys make a participation, roadmap, and node from different
-- course offerings impossible to combine in a single simulated completion.
ALTER TABLE "Roadmap"
ADD CONSTRAINT "Roadmap_id_courseOfferingId_key" UNIQUE ("id", "courseOfferingId");

ALTER TABLE "RoadmapNode"
ADD CONSTRAINT "RoadmapNode_id_roadmapId_key" UNIQUE ("id", "roadmapId");

ALTER TABLE "Participation"
ADD CONSTRAINT "Participation_id_courseOfferingId_key" UNIQUE ("id", "courseOfferingId");

CREATE TABLE "SimulatedCompletion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "participationId" UUID NOT NULL,
    "courseOfferingId" UUID NOT NULL,
    "roadmapId" UUID NOT NULL,
    "roadmapNodeId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedCompletion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SimulatedCompletion_participationId_roadmapNodeId_key"
ON "SimulatedCompletion"("participationId", "roadmapNodeId");

CREATE INDEX "SimulatedCompletion_roadmapNodeId_idx"
ON "SimulatedCompletion"("roadmapNodeId");

CREATE INDEX "SimulatedCompletion_participationId_roadmapId_idx"
ON "SimulatedCompletion"("participationId", "roadmapId");

ALTER TABLE "SimulatedCompletion"
ADD CONSTRAINT "SimulatedCompletion_participationId_courseOfferingId_fkey"
FOREIGN KEY ("participationId", "courseOfferingId") REFERENCES "Participation"("id", "courseOfferingId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulatedCompletion"
ADD CONSTRAINT "SimulatedCompletion_roadmapId_courseOfferingId_fkey"
FOREIGN KEY ("roadmapId", "courseOfferingId") REFERENCES "Roadmap"("id", "courseOfferingId") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SimulatedCompletion"
ADD CONSTRAINT "SimulatedCompletion_roadmapNodeId_roadmapId_fkey"
FOREIGN KEY ("roadmapNodeId", "roadmapId") REFERENCES "RoadmapNode"("id", "roadmapId") ON DELETE CASCADE ON UPDATE CASCADE;
