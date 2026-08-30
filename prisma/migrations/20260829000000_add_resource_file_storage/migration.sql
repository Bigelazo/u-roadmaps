ALTER TABLE "Resource"
ADD COLUMN "fileKey" UUID,
ADD COLUMN "fileContentType" VARCHAR(255);

CREATE UNIQUE INDEX "Resource_fileKey_key" ON "Resource"("fileKey");
