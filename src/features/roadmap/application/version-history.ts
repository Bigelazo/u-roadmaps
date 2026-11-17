import 'server-only';

import {
  type AcademicTermKey,
  compareEditionsNewestFirst,
  compareRecordedStaff,
  isWithinVersionHorizon,
  versionHistoryHorizon,
} from '../domain/version-history';
import type { RoadmapActor } from './participation';
import { getAvailableTypes, nodeDto, resourceDto } from './roadmap';
import { forbidden } from './errors';
import type {
  CourseOfferingIdentifier,
  NodeType,
  RoadmapDependency,
  RoadmapDto,
  RoadmapNode,
} from '../types';
import { openStoredFile } from '../infrastructure/resources/lifecycle';
import { versionApiUrl } from '@/shared/version-history-url';
import { termLabel } from '@/shared/course-offering';
import { requireUuid } from '@/shared/validation';
import type { InstitutionalCoursePosition } from '@/shared/institutional-position';
import { prisma } from '@/shared/server/db';
import { ApplicationError } from '@/shared/errors/server';

const recordedVersionSelect = {
  closedAt: true,
  sourceRoadmapId: true,
  sourceYear: true,
  sourceSemester: true,
  creator: { select: { id: true, name: true, rut: true } },
  closureTeachingStaff: {
    select: {
      institutionalPosition: true,
      user: { select: { id: true, name: true, rut: true } },
    },
  },
} as const;

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
          roadmap: {
            select: {
              id: true,
              ...recordedVersionSelect,
              _count: { select: { roadmapNodes: true } },
            },
          },
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
    throw forbidden('Solo el equipo docente del ramo puede consultar su historial de versiones.');
  return { course, horizon };
}

function recordedSource(roadmap: {
  sourceYear: number | null;
  sourceSemester: number | null;
}): AcademicTermKey | null {
  return roadmap.sourceYear !== null && roadmap.sourceSemester !== null
    ? { year: roadmap.sourceYear, semester: roadmap.sourceSemester }
    : null;
}

type RecordedPerson = { id: string; name: string; rut: string | null };
type RecordedAuthorship = {
  creator: RecordedPerson | null;
  sourceYear: number | null;
  sourceSemester: number | null;
  closureTeachingStaff: {
    institutionalPosition: InstitutionalCoursePosition | null;
    user: RecordedPerson;
  }[];
};
type RosterNames = ReadonlyMap<string, string>;

function readRosterNames(actor: RoadmapActor, roadmaps: readonly RecordedAuthorship[]) {
  const ruts = roadmaps.flatMap(({ creator, closureTeachingStaff }) =>
    [creator, ...closureTeachingStaff.map(({ user }) => user)].flatMap((person) =>
      person?.rut ? [person.rut] : [],
    ),
  );
  return actor.ucampus.getPersonNames([...new Set(ruts)]);
}

function rosterPerson({ id, name, rut }: RecordedPerson, names: RosterNames) {
  return { id, name: (rut ? names.get(rut) : null) ?? name };
}

function recordedOrigin(roadmap: { sourceYear: number | null; sourceSemester: number | null }) {
  const source = recordedSource(roadmap);
  return source
    ? { kind: 'COPY' as const, ...source, edition: termLabel(source) }
    : { kind: 'EMPTY' as const };
}

function recordedAuthorship(roadmap: RecordedAuthorship, names: RosterNames) {
  return {
    creator: roadmap.creator ? rosterPerson(roadmap.creator, names) : null,
    teachingStaff: roadmap.closureTeachingStaff
      .map(({ user, institutionalPosition }) => ({
        ...rosterPerson(user, names),
        institutionalPosition,
      }))
      .sort(compareRecordedStaff),
    origin: recordedOrigin(roadmap),
  };
}

export async function readRoadmapVersionHistory(actor: RoadmapActor, courseCode: string) {
  const { course, horizon } = await requireCourseWithHorizon(actor, courseCode);
  const versions = course.courseOfferings
    .flatMap(({ year, semester, roadmap }) =>
      roadmap?.closedAt && isWithinVersionHorizon({ year, semester }, horizon)
        ? [{ year, semester, closedAt: roadmap.closedAt, roadmap }]
        : [],
    )
    .sort(compareEditionsNewestFirst);
  const names = await readRosterNames(
    actor,
    versions.map(({ roadmap }) => roadmap),
  );
  const [latestOffering] = course.courseOfferings
    .filter(({ participants }) =>
      participants.some(({ role, isActive }) => role === 'TEACHER' && isActive),
    )
    .sort((a, b) => b.year - a.year || b.semester - a.semester);
  const openRoadmap =
    latestOffering?.roadmap && !latestOffering.roadmap.closedAt ? latestOffering.roadmap : null;
  const openTerm =
    latestOffering && openRoadmap
      ? await prisma.academicTerm.findUnique({
          where: {
            year_semester: { year: latestOffering.year, semester: latestOffering.semester },
          },
          select: { roadmapFreezeDate: true },
        })
      : null;
  return {
    course: { code: course.code, name: course.name },
    horizon,
    latestOffering: latestOffering
      ? {
          year: latestOffering.year,
          semester: latestOffering.semester,
          hasRoadmap: latestOffering.roadmap !== null,
        }
      : null,
    current:
      latestOffering && openRoadmap
        ? {
            year: latestOffering.year,
            semester: latestOffering.semester,
            edition: termLabel(latestOffering),
            origin: recordedOrigin(openRoadmap),
            nodeCount: openRoadmap._count.roadmapNodes,
            closesOn: openTerm?.roadmapFreezeDate.toISOString().slice(0, 10) ?? null,
          }
        : null,
    versions: versions.map(({ year, semester, closedAt, roadmap }) => ({
      year,
      semester,
      edition: termLabel({ year, semester }),
      closedAt: closedAt.toISOString(),
      nodeCount: roadmap._count.roadmapNodes,
      ...recordedAuthorship(roadmap, names),
    })),
  };
}

export type RoadmapVersionHistory = Awaited<ReturnType<typeof readRoadmapVersionHistory>>;

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

export async function readRoadmapVersion(
  actor: RoadmapActor,
  identifier: CourseOfferingIdentifier,
) {
  const { course, horizon, offering, roadmap } = await requireVisibleVersion(actor, identifier);
  const [nodes, dependencies, nodeTypes, names] = await Promise.all([
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
    readRosterNames(actor, [roadmap]),
  ]);
  const term = { year: offering.year, semester: offering.semester };
  const ancestry: AcademicTermKey[] = [term];
  let oldest: {
    sourceRoadmapId: string | null;
    sourceYear: number | null;
    sourceSemester: number | null;
  } = roadmap;
  const visited = new Set([roadmap.id]);
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
  const removedSource = recordedSource(oldest);
  if (removedSource) ancestry.unshift(removedSource);
  const lineage = ancestry
    .filter((ancestor) => isWithinVersionHorizon(ancestor, horizon))
    .map((ancestor) => ({ ...ancestor, edition: termLabel(ancestor) }));
  const roadmapDto = {
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
    course: { code: course.code, name: course.name },
    horizon,
    version: {
      ...term,
      edition: termLabel(term),
      closedAt: roadmap.closedAt.toISOString(),
      ...recordedAuthorship(roadmap, names),
      lineage,
    },
  };
}

export type RoadmapVersion = Awaited<ReturnType<typeof readRoadmapVersion>>;

export async function downloadRoadmapVersionResource(
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
  return {
    ...(await openStoredFile(resource.fileKey)),
    contentType: resource.fileContentType ?? 'application/octet-stream',
    title: resource.title,
  };
}
