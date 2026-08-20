CREATE TYPE "ResourceType" AS ENUM ('FILE', 'LINK', 'VIDEO');
CREATE TYPE "ParticipationRole" AS ENUM ('STUDENT', 'TEACHER');

CREATE TABLE "Course" (
    "code" VARCHAR(20) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "department" VARCHAR(200) NOT NULL,
    CONSTRAINT "Course_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "CourseOffering" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseCode" VARCHAR(20) NOT NULL,
    "year" INTEGER NOT NULL,
    "semester" INTEGER NOT NULL,
    CONSTRAINT "CourseOffering_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CourseOffering_academic_term_check" CHECK ("year" > 0 AND "semester" IN (1, 2))
);

CREATE TABLE "Roadmap" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "courseOfferingId" UUID NOT NULL,
    CONSTRAINT "Roadmap_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NodeType" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "normalizedName" VARCHAR(120) NOT NULL,
    "color" VARCHAR(7) NOT NULL,
    "isPredefined" BOOLEAN NOT NULL DEFAULT false,
    "roadmapId" UUID,
    CONSTRAINT "NodeType_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeType_color_check" CHECK ("color" ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT "NodeType_scope_check" CHECK (("isPredefined" = true AND "roadmapId" IS NULL) OR ("isPredefined" = false AND "roadmapId" IS NOT NULL))
);

CREATE TABLE "RoadmapNode" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roadmapId" UUID NOT NULL,
    "nodeTypeId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "description" TEXT,
    "positionX" DOUBLE PRECISION NOT NULL,
    "positionY" DOUBLE PRECISION NOT NULL,
    "isVisible" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "RoadmapNode_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RoadmapNode_position_check" CHECK ("positionX" < 'Infinity'::double precision AND "positionX" > '-Infinity'::double precision AND "positionY" < 'Infinity'::double precision AND "positionY" > '-Infinity'::double precision)
);

CREATE TABLE "Dependency" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sourceNodeId" UUID NOT NULL,
    "targetNodeId" UUID NOT NULL,
    CONSTRAINT "Dependency_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Dependency_self_check" CHECK ("sourceNodeId" <> "targetNodeId")
);

CREATE TABLE "Resource" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "roadmapNodeId" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "url" TEXT NOT NULL,
    "type" "ResourceType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Resource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(200) NOT NULL,
    "institutionalEmail" VARCHAR(320) NOT NULL,
    "rut" VARCHAR(20),
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Participation" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "courseOfferingId" UUID NOT NULL,
    "role" "ParticipationRole" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Participation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Completion" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "roadmapNodeId" UUID NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Completion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CourseOffering_courseCode_year_semester_key" ON "CourseOffering"("courseCode", "year", "semester");
CREATE INDEX "CourseOffering_courseCode_idx" ON "CourseOffering"("courseCode");
CREATE UNIQUE INDEX "Roadmap_courseOfferingId_key" ON "Roadmap"("courseOfferingId");
CREATE UNIQUE INDEX "NodeType_roadmapId_normalizedName_key" ON "NodeType"("roadmapId", "normalizedName");
CREATE INDEX "NodeType_isPredefined_idx" ON "NodeType"("isPredefined");
CREATE INDEX "RoadmapNode_roadmapId_idx" ON "RoadmapNode"("roadmapId");
CREATE INDEX "RoadmapNode_nodeTypeId_idx" ON "RoadmapNode"("nodeTypeId");
CREATE UNIQUE INDEX "Dependency_sourceNodeId_targetNodeId_key" ON "Dependency"("sourceNodeId", "targetNodeId");
CREATE INDEX "Dependency_targetNodeId_idx" ON "Dependency"("targetNodeId");
CREATE INDEX "Resource_roadmapNodeId_idx" ON "Resource"("roadmapNodeId");
CREATE UNIQUE INDEX "User_institutionalEmail_key" ON "User"("institutionalEmail");
CREATE UNIQUE INDEX "User_rut_key" ON "User"("rut");
CREATE UNIQUE INDEX "Participation_userId_courseOfferingId_key" ON "Participation"("userId", "courseOfferingId");
CREATE INDEX "Participation_courseOfferingId_role_idx" ON "Participation"("courseOfferingId", "role");
CREATE UNIQUE INDEX "Completion_userId_roadmapNodeId_key" ON "Completion"("userId", "roadmapNodeId");
CREATE INDEX "Completion_roadmapNodeId_idx" ON "Completion"("roadmapNodeId");

ALTER TABLE "CourseOffering" ADD CONSTRAINT "CourseOffering_courseCode_fkey" FOREIGN KEY ("courseCode") REFERENCES "Course"("code") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Roadmap" ADD CONSTRAINT "Roadmap_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "NodeType" ADD CONSTRAINT "NodeType_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoadmapNode" ADD CONSTRAINT "RoadmapNode_roadmapId_fkey" FOREIGN KEY ("roadmapId") REFERENCES "Roadmap"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RoadmapNode" ADD CONSTRAINT "RoadmapNode_nodeTypeId_fkey" FOREIGN KEY ("nodeTypeId") REFERENCES "NodeType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_sourceNodeId_fkey" FOREIGN KEY ("sourceNodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dependency" ADD CONSTRAINT "Dependency_targetNodeId_fkey" FOREIGN KEY ("targetNodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Resource" ADD CONSTRAINT "Resource_roadmapNodeId_fkey" FOREIGN KEY ("roadmapNodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Participation" ADD CONSTRAINT "Participation_courseOfferingId_fkey" FOREIGN KEY ("courseOfferingId") REFERENCES "CourseOffering"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Completion" ADD CONSTRAINT "Completion_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Completion" ADD CONSTRAINT "Completion_roadmapNodeId_fkey" FOREIGN KEY ("roadmapNodeId") REFERENCES "RoadmapNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
