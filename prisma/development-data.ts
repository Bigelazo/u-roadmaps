import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';
import {
  developmentFixtureCourses,
  developmentFixtureOfferings,
  fixtureCompletions,
  fixtureParticipations,
  fixtureResources,
  fixtureRoadmaps,
  fixtureUsers,
  predefinedNodeTypes,
  reservedFixtureOfferingIds,
  reservedFixtureUserIds,
} from '../src/lib/development-fixtures';
import { developmentFixtureFileContents } from '../src/lib/development-fixture-assets';
import { requireFixtureEnvironment } from '../src/lib/development';
import { replaceFixtureUploadedFiles } from '../src/lib/resource-storage';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL must be set to load development data.');
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export async function resetDevelopmentData() {
  requireFixtureEnvironment();
  await replaceFixtureUploadedFiles(developmentFixtureFileContents());

  await prisma.$transaction(async (transaction) => {
    await transaction.courseOffering.deleteMany({
      where: { id: { in: reservedFixtureOfferingIds } },
    });
    await transaction.user.deleteMany({ where: { id: { in: reservedFixtureUserIds } } });

    await Promise.all(
      developmentFixtureCourses.map((course) =>
        transaction.course.upsert({
          where: { code: course.code },
          update: { name: course.name, department: course.department },
          create: course,
        }),
      ),
    );
    await Promise.all(
      predefinedNodeTypes.map((nodeType) =>
        transaction.nodeType.upsert({
          where: { id: nodeType.id },
          update: {
            name: nodeType.name,
            normalizedName: nodeType.name.toLocaleLowerCase('es-CL'),
            color: nodeType.color,
            isPredefined: true,
            roadmapId: null,
          },
          create: {
            ...nodeType,
            normalizedName: nodeType.name.toLocaleLowerCase('es-CL'),
            isPredefined: true,
          },
        }),
      ),
    );

    await transaction.courseOffering.createMany({
      data: developmentFixtureOfferings.map(({ id, courseCode, year, semester }) => ({
        id,
        courseCode,
        year,
        semester,
      })),
    });
    await transaction.user.createMany({ data: [...fixtureUsers] });
    await transaction.participation.createMany({
      data: fixtureParticipations.map(({ userId, courseOfferingId, role, isActive }) => ({
        userId,
        courseOfferingId,
        role,
        isActive,
      })),
    });
    await transaction.roadmap.createMany({
      data: fixtureRoadmaps.map(({ id, courseOfferingId }) => ({ id, courseOfferingId })),
    });
    await transaction.nodeType.createMany({
      data: fixtureRoadmaps.map(({ id: roadmapId, customNodeType }) => ({
        ...customNodeType,
        roadmapId,
        normalizedName: customNodeType.name.toLocaleLowerCase('es-CL'),
      })),
    });
    await transaction.roadmapNode.createMany({
      data: fixtureRoadmaps.flatMap(({ nodes }) => nodes),
    });
    await transaction.dependency.createMany({
      data: fixtureRoadmaps.flatMap(({ dependencies }) => dependencies),
    });
    await transaction.resource.createMany({
      data: fixtureResources.map(
        ({ id, roadmapNodeId, title, type, url, fileKey, fileContentType }) => ({
          id,
          roadmapNodeId,
          title,
          type,
          url,
          fileKey,
          fileContentType,
        }),
      ),
    });
    await transaction.completion.createMany({ data: fixtureCompletions });
  });
}

async function main() {
  await resetDevelopmentData();
}
if (process.argv[1]?.endsWith('development-data.ts')) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
