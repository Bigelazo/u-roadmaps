CREATE TABLE "VtiLoginTransaction" (
    "state" UUID NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VtiLoginTransaction_pkey" PRIMARY KEY ("state")
);

CREATE INDEX "VtiLoginTransaction_expiresAt_idx" ON "VtiLoginTransaction"("expiresAt");
