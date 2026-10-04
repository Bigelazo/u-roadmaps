CREATE TABLE "NoticeDeliveryEffect" (
  "eventId" TEXT NOT NULL,
  "recipientId" UUID NOT NULL,
  CONSTRAINT "NoticeDeliveryEffect_pkey" PRIMARY KEY ("eventId", "recipientId"),
  CONSTRAINT "NoticeDeliveryEffect_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Preserve deduplication for notices accepted before grouping was introduced.
INSERT INTO "NoticeDeliveryEffect" ("eventId", "recipientId")
SELECT "eventId", "recipientId" FROM "RoadmapNotice";
