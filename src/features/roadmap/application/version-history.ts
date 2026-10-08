import 'server-only';

import {
  type AcademicTermKey,
  compareEditionsNewestFirst,
  compareRecordedStaff,
  editionLabel,
  isWithinVersionHorizon,
  versionHistoryHorizon,
} from '../domain/version-history';
import type { RoadmapActor } from './participation';
import { getAvailableTypes, nodeDto, resourceDto } from './roadmap';
import type {
  CourseOfferingIdentifier,
  NodeType,
  RoadmapDependency,
  RoadmapDto,
  RoadmapNode,
} from '../types';
import { readUploadedFile } from '../infrastructure/resources/filesystem';
import { versionApiUrl } from '@/shared/version-history-url';
import { requireUuid } from '@/shared/validation';
import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';

const recordedVersionSelect = {
  closedAt: true,
  sourceRoadmapId: true,
  sourceYear: true,
  sourceSemester: true,
  creator: { select: { id: true, name: true } },
  closureTeachingStaff: {
    select: {
      institutionalPosition: true,
      user: { select: { id: true, name: true } },
    },
  },
} as const;

/** The Course (Ramo) with its offerings, refused unless the actor has a version horizon. */
async function requireCourseWithHorizon(actor: RoadmapActor, courseCode: string) {
  const course = await prisma.course.findUnique({
    where: { code: courseCode },
    select: {
      code: true,
      name: true,
      department: true,
      courseOfferings: {
        select: {
          id: true,
          year: true,
          semester: true,
          participants: {
            where: { userId: actor.id },
            select: { role: true, isActive: true },
          },
          roadmap: { select: { id: true, ...recordedVersionSelect } },
        },
      },
    },
  });
  if (!course) throw new ApplicationError(404, 'COURSE_NOT_FOUND', 'El ramo solicitado no existe.');
  const horizon = versionHistoryHorizon(
    course.courseOfferings.flatMap(({ year, semester, participants }) =>
      participants.map((participation) => ({ year, semester, ...participation })),
    ),
  );
  if (!horizon)
    throw new ApplicationError(
      403,
      'FORBIDDEN',
      'Solo el equipo docente del ramo puede consultar su historial de versiones.',
    );
  return { course, horizon };
}

/** The recorded source edition, which outlives the source Roadmap itself. */
function recordedSource(roadmap: {
  sourceYear: number | null;
  sourceSemester: number | null;
}): AcademicTermKey | null {
  return roadmap.sourceYear !== null && roadmap.sourceSemester !== null
    ? { year: roadmap.sourceYear, semester: roadmap.sourceSemester }
    : null;
}

function recordedAuthorship(roadmap: {
  creator: { id: string; name: string } | null;
  sourceYear: number | null;
  sourceSemester: number | null;
  closureTeachingStaff: {
    institutionalPosition: InstitutionalCoursePosition | null;
    user: { id: string; name: string };
  }[];
}) {
  const source = recordedSource(roadmap);
  return {
    creator: roadmap.creator,
    teachingStaff: roadmap.closureTeachingStaff
      .map(({ user, institutionalPosition }) => ({ ...user, institutionalPosition }))
      .sort(compareRecordedStaff),
    origin: source
      ? { kind: 'COPY' as const, ...source, edition: editionLabel(source) }
      : { kind: 'EMPTY' as const },
  };
}

async function readRoadmapVersionHistoryUnsafe(actor: RoadmapActor, courseCode: string) {
  const { course, horizon } = await requireCourseWithHorizon(actor, courseCode);
  const versions = course.courseOfferings
    .flatMap(({ year, semester, roadmap }) =>
      roadmap?.closedAt && isWithinVersionHorizon({ year, semester }, horizon)
        ? [{ year, semester, closedAt: roadmap.closedAt, roadmap }]
        : [],
    )
    .sort(compareEditionsNewestFirst)
    .map(({ year, semester, closedAt, roadmap }) => ({
      year,
      semester,
      edition: editionLabel({ year, semester }),
      closedAt: closedAt.toISOString(),
      ...recordedAuthorship(roadmap),
    }));
  return { course: { code: course.code, name: course.name }, horizon, versions };
}

export type RoadmapVersionHistory = Awaited<ReturnType<typeof readRoadmapVersionHistoryUnsafe>>;

export function readRoadmapVersionHistory(actor: RoadmapActor, courseCode: string) {
  return applicationResult(() => readRoadmapVersionHistoryUnsafe(actor, courseCode));
}

/**
 * A closed Roadmap of the Course within the actor's horizon. Every refusal looks
 * missing, so the API never reveals which Courses or versions exist.
 */
async function requireVisibleVersion(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  const missing = () =>
    new ApplicationError(404, 'VERSION_NOT_FOUND', 'La versión solicitada no existe.');
  const { course, horizon } = await requireCourseWithHorizon(actor, identifier.courseCode).catch(
    (error: unknown) => {
      throw error instanceof ApplicationError ? missing() : error;
    },
  );
  const offering = course.courseOfferings.find(
    ({ year, semester }) => year === identifier.year && semester === identifier.semester,
  );
  const roadmap = offering?.roadmap;
  if (!offering || !roadmap?.closedAt || !isWithinVersionHorizon(offering, horizon))
    throw missing();
  return { course, horizon, offering, roadmap: { ...roadmap, closedAt: roadmap.closedAt } };
}

// Reads only the Roadmap's own content: never Participations, Completions or visits.
async function readRoadmapVersionUnsafe(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  const { course, horizon, offering, roadmap } = await requireVisibleVersion(actor, identifier);
  const [nodes, dependencies, nodeTypes] = await Promise.all([
    prisma.roadmapNode.findMany({
      where: { roadmapId: roadmap.id },
      orderBy: { title: 'asc' },
      include: { resources: { orderBy: { title: 'asc' } } },
    }),
    prisma.dependency.findMany({
      where: { sourceNode: { roadmapId: roadmap.id } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        sourceNodeId: true,
        targetNodeId: true,
        sourceHandle: true,
        targetHandle: true,
      },
    }),
    getAvailableTypes(roadmap.id),
  ]);
  const term = { year: offering.year, semester: offering.semester };
  // Oldest first, ending at this version, following each copy to its source.
  const ancestry: AcademicTermKey[] = [term];
  let oldest: {
    sourceRoadmapId: string | null;
    sourceYear: number | null;
    sourceSemester: number | null;
  } = roadmap;
  const visited = new Set([roadmap.id]);
  // The guard stops on a corrupt cyclic lineage instead of looping forever.
  while (oldest.sourceRoadmapId && !visited.has(oldest.sourceRoadmapId)) {
    visited.add(oldest.sourceRoadmapId);
    const ancestor = await prisma.roadmap.findUnique({
      where: { id: oldest.sourceRoadmapId },
      select: {
        sourceRoadmapId: true,
        sourceYear: true,
        sourceSemester: true,
        courseOffering: { select: { year: true, semester: true } },
      },
    });
    if (!ancestor) break;
    ancestry.unshift(ancestor.courseOffering);
    oldest = ancestor;
  }
  // The oldest reachable version still names its source's edition if that source was removed.
  const removedSource = recordedSource(oldest);
  if (removedSource) ancestry.unshift(removedSource);
  const lineage = ancestry
    .filter((ancestor) => isWithinVersionHorizon(ancestor, horizon))
    .map((ancestor) => ({ ...ancestor, edition: editionLabel(ancestor) }));
  const roadmapDto = {
    course: { code: course.code, name: course.name, department: course.department },
    courseOffering: { id: offering.id, ...term },
    roadmap: { id: roadmap.id, closedAt: roadmap.closedAt.toISOString() },
    nodeTypes: nodeTypes as NodeType[],
    nodes: nodes.map((node) => ({
      ...(nodeDto(node) as Omit<RoadmapNode, 'resources'>),
      resources: node.resources.map((resource) =>
        resourceDto({
          ...resource,
          fileKey: null,
          url: resource.fileKey
            ? versionApiUrl(identifier, `/resources/${resource.id}/file`)
            : resource.url,
        }),
      ),
    })) as RoadmapNode[],
    dependencies: dependencies as RoadmapDependency[],
  } satisfies RoadmapDto;
  return {
    ...roadmapDto,
    horizon,
    version: {
      ...term,
      edition: editionLabel(term),
      closedAt: roadmap.closedAt.toISOString(),
      ...recordedAuthorship(roadmap),
      lineage,
    },
  };
}

export type RoadmapVersion = Awaited<ReturnType<typeof readRoadmapVersionUnsafe>>;

export function readRoadmapVersion(actor: RoadmapActor, identifier: CourseOfferingIdentifier) {
  return applicationResult(() => readRoadmapVersionUnsafe(actor, identifier));
}

async function downloadRoadmapVersionResourceUnsafe(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  resourceId: string,
) {
  const { roadmap } = await requireVisibleVersion(actor, identifier);
  const resource = await prisma.resource.findFirst({
    where: { id: requireUuid(resourceId, 'resourceId'), roadmapNode: { roadmapId: roadmap.id } },
  });
  if (!resource?.fileKey)
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en esta versión.');
  try {
    return {
      bytes: await readUploadedFile(resource.fileKey),
      contentType: resource.fileContentType ?? 'application/octet-stream',
      title: resource.title,
    };
  } catch (error) {
    // Only a missing file is a missing Resource; other storage failures surface.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    throw new ApplicationError(404, 'RESOURCE_NOT_FOUND', 'El archivo ya no está disponible.');
  }
}

export function downloadRoadmapVersionResource(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
  resourceId: string,
) {
  return applicationResult(() =>
    downloadRoadmapVersionResourceUnsafe(actor, identifier, resourceId),
  );
}
