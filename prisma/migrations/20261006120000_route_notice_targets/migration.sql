ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "routeSnapshots" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "RouteNoticeKnowledge" (
 "recipientId" UUID NOT NULL,
 "roadmapId" UUID NOT NULL,
 "targetKey" TEXT NOT NULL,
 "knownValue" TEXT NOT NULL,
 CONSTRAINT "RouteNoticeKnowledge_pkey" PRIMARY KEY ("recipientId", "roadmapId", "targetKey"),
 CONSTRAINT "RouteNoticeKnowledge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "RouteNoticeKnowledge_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
