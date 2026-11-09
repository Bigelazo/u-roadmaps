-- AlterTable
ALTER TABLE "Resource" ADD COLUMN     "fileSize" INTEGER;

-- CreateTable
CREATE TABLE "ResourceAccess" (
    "userId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "accessCount" INTEGER NOT NULL,
    "isReviewed" BOOLEAN NOT NULL,

    CONSTRAINT "ResourceAccess_pkey" PRIMARY KEY ("userId","resourceId")
);

-- CreateTable
CREATE TABLE "SimulatedResourceReview" (
    "participationId" UUID NOT NULL,
    "resourceId" UUID NOT NULL,
    "reviewedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedResourceReview_pkey" PRIMARY KEY ("participationId","resourceId")
);

-- CreateIndex
CREATE INDEX "ResourceAccess_resourceId_idx" ON "ResourceAccess"("resourceId");

-- CreateIndex
CREATE INDEX "SimulatedResourceReview_resourceId_idx" ON "SimulatedResourceReview"("resourceId");

-- AddForeignKey
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedResourceReview" ADD CONSTRAINT "SimulatedResourceReview_participationId_fkey" FOREIGN KEY ("participationId") REFERENCES "Participation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedResourceReview" ADD CONSTRAINT "SimulatedResourceReview_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- CreateCheck
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_file_size_check" CHECK (
  "fileSize" IS NULL OR (type = 'FILE' AND "fileSize" > 0)
);

-- CreateCheck
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_access_count_check" CHECK ("accessCount" > 0);
