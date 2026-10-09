-- AlterTable
ALTER TABLE "User" ADD COLUMN "postCreationInvitationShownAt" TIMESTAMPTZ(3),
ADD COLUMN "teachingTutorialOpenedAt" TIMESTAMPTZ(3);
