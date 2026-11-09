ALTER TABLE "ResourceAccess" DROP CONSTRAINT IF EXISTS "ResourceAccess_access_count_check";
ALTER TABLE "ResourceAccess" ADD CONSTRAINT "ResourceAccess_access_count_check" CHECK ("accessCount" >= 0);

INSERT INTO "ResourceAccess" ("userId", "resourceId", "accessCount", "isReviewed")
SELECT DISTINCT completion."userId", resource.id, 0, true
FROM "Completion" completion
JOIN "RoadmapNode" node ON node.id = completion."roadmapNodeId"
JOIN "Roadmap" roadmap ON roadmap.id = node."roadmapId"
JOIN "Participation" participation
  ON participation."userId" = completion."userId"
  AND participation."courseOfferingId" = roadmap."courseOfferingId"
  AND participation.role = 'STUDENT'
JOIN "Resource" resource ON resource."roadmapNodeId" = node.id
ON CONFLICT ("userId", "resourceId") DO UPDATE SET "isReviewed" = true;

INSERT INTO "SimulatedResourceReview" ("participationId", "resourceId")
SELECT completion."participationId", resource.id
FROM "SimulatedCompletion" completion
JOIN "Resource" resource ON resource."roadmapNodeId" = completion."roadmapNodeId"
ON CONFLICT ("participationId", "resourceId") DO NOTHING;
