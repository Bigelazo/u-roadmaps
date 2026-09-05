import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/shared/server/db';
import {
  developmentFixtureCourses,
  developmentFixtureOfferings,
  fixtureCompletions,
  fixtureParticipations,
  fixtureResources,
  fixtureRoadmaps,
  fixtureSimulatedCompletions,
  fixtureUsers,
  predefinedNodeTypes,
  reservedFixtureOfferingIds,
  reservedFixtureUserIds,
} from '../fixtures/catalog';
import { developmentFixtureFileContents } from './assets';

const fixtureUploadsDirectory = join(process.cwd(), 'uploads');

async function replaceFixtureUploadedFiles(files: readonly { fileKey: string; bytes: Buffer }[]) {
  await mkdir(fixtureUploadsDirectory, { recursive: true });
  await Promise.all(
    files.map(({ fileKey, bytes }) => writeFile(join(fixtureUploadsDirectory, fileKey), bytes)),
  );
}

function upsertPredefinedNodeTypes() {
  return Promise.all(
    predefinedNodeTypes.map((nodeType) =>
      prisma.nodeType.upsert({
        where: { id: nodeType.id },
        update: {
          name: nodeType.name,
          normalizedName: nodeType.name.toLocaleLowerCase('es-CL'),
          icon: nodeType.icon,
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
}

export async function seedPredefinedNodeTypes() {
  await upsertPredefinedNodeTypes();
}

export async function resetDevelopmentData() {
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
            icon: nodeType.icon,
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
    await Promise.all(
      fixtureSimulatedCompletions.map(async ({ userId, ...completion }) => {
        const participation = await transaction.participation.findUnique({
          where: {
            userId_courseOfferingId: {
              userId,
              courseOfferingId: completion.courseOfferingId,
            },
          },
          select: { id: true },
        });
        if (!participation)
          throw new Error('Missing fixture participation for simulated completion.');
        return transaction.simulatedCompletion.create({
          data: { ...completion, participationId: participation.id },
        });
      }),
    );
  });
}
