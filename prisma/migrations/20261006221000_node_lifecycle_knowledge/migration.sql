CREATE TABLE "NodeLifecycleKnowledge" (
  "recipientId" UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "roadmapId" UUID NOT NULL REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "nodeId" UUID NOT NULL,
  "isKnown" BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY ("recipientId", "roadmapId", "nodeId")
);
