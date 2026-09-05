CREATE TABLE "AcademicTerm" (
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    "lastClassDay" DATE NOT NULL,
    "examStartDay" DATE NOT NULL,
    "examEndDay" DATE NOT NULL,
    "roadmapFreezeDate" DATE NOT NULL,
    "sourcePageUrl" TEXT NOT NULL,
    "sourcePdfUrl" TEXT NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("year", "semester")
);
