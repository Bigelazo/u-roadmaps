ALTER TABLE "NoticeAcknowledgement" ADD COLUMN "resourceSnapshots" JSONB NOT NULL DEFAULT '[]';
CREATE TABLE "ResourceNoticeKnowledge" (
  "recipientId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "nodeId" UUID NOT NULL,
  "knownState" TEXT,
  CONSTRAINT "ResourceNoticeKnowledge_pkey" PRIMARY KEY ("recipientId", "resourceId"),
  CONSTRAINT "ResourceNoticeKnowledge_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ResourceNoticeKnowledge_nodeId_fkey" FOREIGN KEY ("nodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
