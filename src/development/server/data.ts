import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { prisma } from '@/shared/server/db';
import {
  developmentFixtureCourses,
  developmentFixtureOfferings,
  fixtureCompletions,
  fixtureAcademicTerms,
  fixtureClosureTeachingStaff,
  fixtureParticipations,
  fixtureResources,
  fixtureRoadmaps,
  fixtureSimulatedCompletions,
  fixtureUsers,
  normalizedNodeTypeName,
  predefinedNodeTypes,
  reservedFixtureOfferingIds,
  reservedFixtureUserIds,
} from '../fixtures/catalog';
import { developmentFixtureFileContents } from './assets';

// Uploaded files are runtime data, not build dependencies.
const fixtureUploadsDirectory = join(
  /* turbopackIgnore: true */ process.cwd(),
  process.env.UPLOADS_DIRECTORY || 'uploads',
);

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
          normalizedName: normalizedNodeTypeName(nodeType.name),
          icon: nodeType.icon,
          color: nodeType.color,
          isPredefined: true,
          roadmapId: null,
        },
        create: {
          ...nodeType,
          normalizedName: normalizedNodeTypeName(nodeType.name),
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
  const previousFiles = await prisma.resource.findMany({
    where: {
      fileKey: { not: null },
      roadmapNode: { roadmap: { courseOfferingId: { in: reservedFixtureOfferingIds } } },
    },
    select: { fileKey: true },
  });

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
            normalizedName: normalizedNodeTypeName(nodeType.name),
            icon: nodeType.icon,
            color: nodeType.color,
            isPredefined: true,
            roadmapId: null,
          },
          create: {
            ...nodeType,
            normalizedName: normalizedNodeTypeName(nodeType.name),
            isPredefined: true,
          },
        }),
      ),
    );

    for (const term of fixtureAcademicTerms) {
      await transaction.academicTerm.upsert({
        where: { year_semester: { year: term.year, semester: term.semester } },
        create: term,
        update: term,
      });
    }
    await transaction.courseOffering.createMany({
      data: developmentFixtureOfferings.map(({ id, courseCode, year, semester }) => ({
        id,
        courseCode,
        year,
        semester,
      })),
    });
    await transaction.user.createMany({
      data: fixtureUsers.map((user) => ({
        ...user,
        // Catalog browser checks stay read-only; invitation tests own their Users.
        ...(process.env.U_ROADMAPS_E2E_DATA === 'true'
          ? { tutorialInvitationShownAt: new Date('2026-08-15T12:00:00.000Z') }
          : {}),
      })),
    });
    await transaction.participation.createMany({
      data: fixtureParticipations.map(
        ({ userId, courseOfferingId, role, institutionalPosition, isActive }) => ({
          userId,
          courseOfferingId,
          role,
          institutionalPosition,
          isActive,
        }),
      ),
    });
    await transaction.roadmap.createMany({
      data: fixtureRoadmaps.map(
        ({ id, courseOfferingId, creatorId, closedAt, sourceYear, sourceSemester }) => ({
          id,
          courseOfferingId,
          creatorId,
          closedAt,
          sourceYear,
          sourceSemester,
        }),
      ),
    });
    for (const { id, sourceRoadmapId } of fixtureRoadmaps) {
      if (sourceRoadmapId)
        await transaction.roadmap.update({ where: { id }, data: { sourceRoadmapId } });
    }
    await transaction.roadmapClosureTeachingStaff.createMany({ data: fixtureClosureTeachingStaff });
    await transaction.nodeType.createMany({
      data: fixtureRoadmaps.map(({ id: roadmapId, customNodeType }) => ({
        ...customNodeType,
        roadmapId,
        normalizedName: normalizedNodeTypeName(customNodeType.name),
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
  await Promise.all(
    previousFiles.map(({ fileKey }) =>
      fileKey ? rm(join(fixtureUploadsDirectory, fileKey), { force: true }) : Promise.resolve(),
    ),
  );
  await replaceFixtureUploadedFiles(developmentFixtureFileContents());
}
