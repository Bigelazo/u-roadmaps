ALTER TABLE "AcademicTerm"
ADD COLUMN "classStartDay" DATE,
ADD COLUMN "recesses" JSONB NOT NULL DEFAULT '[]';
