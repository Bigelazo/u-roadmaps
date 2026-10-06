-- Mutable target notices need value snapshots, not just stable notice identities.
ALTER TABLE "NoticeAcknowledgement"
  ADD COLUMN "titleSnapshots" JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN "recognizedAt" TIMESTAMPTZ(3);
