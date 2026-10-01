CREATE TABLE "NoticeAcknowledgement" (
  "recipientId" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "roadmapId" UUID NOT NULL,
  "openedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "NoticeAcknowledgement_pkey" PRIMARY KEY ("recipientId", "operationId")
);
