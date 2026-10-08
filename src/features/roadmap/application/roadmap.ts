import 'server-only';

import { randomUUID } from 'node:crypto';
import { resolveRoadmapFreezeDate, roadmapClosureInstant } from '../domain/closure';
import { planRoadmapCopy, type RoadmapCopySource } from '../domain/roadmap-copy';
import type { VersionIdentifier } from '@/shared/version-history-url';

import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import {
  isNodeTypeColor,
  isNodeTypeIconId,
  type NodeTypeColor,
  type NodeTypeIconId,
} from '@/features/roadmap/node-type-appearance';
import { Prisma, prisma } from '@/shared/server/db';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
export { wouldCreateDependencyCycle as findCycle } from '@/features/roadmap/domain/access';

type JsonObject = Record<string, unknown>;

export { normalizeName } from '../domain/roadmap-copy';

export function requireString(value: unknown, field: string, maxLength?: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    (maxLength !== undefined && value.trim().length > maxLength)
  ) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un texto no vacío.`);
  }
  return value.trim();
}

export function optionalString(
  value: unknown,
  field: string,
  maxLength?: number,
): string | null | undefined {
  if (value === undefined || value === null) return value === null ? null : undefined;
  return requireString(value, field, maxLength);
}

/** Validate optional Node description text without changing its exact content. */
export function nodeDescription(value: unknown): string | null | undefined {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string' || !value.trim())
    throw new ApplicationError(400, 'INVALID_REQUEST', 'description debe ser un texto no vacío.');
  return value;
}

export function requireFiniteNumber(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser un número finito.`);
  }
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApplicationError(400, 'INVALID_REQUEST', `${field} debe ser booleano.`);
  }
  return value;
}

export function requireNodeTypeColor(value: unknown): NodeTypeColor {
  const color = requireString(value, 'color');
  if (!isNodeTypeColor(color)) {
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'color debe pertenecer a la paleta de tipos de nodo.',
    );
  }
  return color.toUpperCase() as NodeTypeColor;
}

export function requireNodeTypeIcon(value: unknown): NodeTypeIconId {
  const icon = requireString(value, 'icon');
  if (!isNodeTypeIconId(icon)) {
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'icon debe pertenecer al catálogo de íconos docentes.',
    );
  }
  return icon;
}

export function requireResourceType(value: unknown): 'FILE' | 'LINK' | 'VIDEO' {
  if (value !== 'FILE' && value !== 'LINK' && value !== 'VIDEO') {
    throw new ApplicationError(400, 'INVALID_RESOURCE_TYPE', 'type debe ser FILE, LINK o VIDEO.');
  }
  return value;
}

export function requireUrl(value: unknown): string {
  const url = requireString(value, 'url');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
      throw new Error('Unsupported URL scheme');
  } catch {
    throw new ApplicationError(400, 'INVALID_URL', 'url debe ser una URL válida.');
  }
  return url;
}

export function resourceDownloadUrl(identifier: CourseOfferingIdentifier, resourceId: string) {
  return `/api/${encodeURIComponent(identifier.courseCode)}/${identifier.year}/${identifier.semester}/roadmap/resources/${resourceId}/file`;
}

export function resourceDto(
  resource: {
    id: string;
    title: string;
    url: string;
    type: 'FILE' | 'LINK' | 'VIDEO';
    fileKey?: string | null;
  },
  identifier?: CourseOfferingIdentifier,
) {
  return {
    id: resource.id,
    title: resource.title,
    url:
      resource.fileKey && identifier ? resourceDownloadUrl(identifier, resource.id) : resource.url,
    type: resource.type,
  };
}

async function requireRoadmapUnsafe(identifier: CourseOfferingIdentifier) {
  const roadmap = await prisma.roadmap.findFirst({
    where: {
      courseOffering: identifier,
    },
  });
  if (!roadmap) {
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return roadmap;
}

export function nodeDto(node: {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  teacherUnlockOn?: Date | null;
}) {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    positionX: node.positionX,
    positionY: node.positionY,
    nodeTypeId: node.nodeTypeId,
    isVisible: node.isVisible,
    isTeacherBlocked: node.isTeacherBlocked,
    ...(node.teacherUnlockOn
      ? { teacherUnlockOn: node.teacherUnlockOn.toISOString().slice(0, 10) }
      : {}),
  };
}

export async function getAvailableTypes(roadmapId: string) {
  const [predefined, custom] = await Promise.all([
    prisma.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
    prisma.nodeType.findMany({ where: { roadmapId }, orderBy: { name: 'asc' } }),
  ]);
  return [...predefined, ...custom].map((type) => ({
    id: type.id,
    name: type.name,
    icon: type.icon as NodeTypeIconId,
    color: type.color,
    isPredefined: type.isPredefined,
  }));
}

export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con un recurso existente.',
      );
    if (error.code === 'P2025')
      throw new ApplicationError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    if (error.code === 'P2034')
      throw new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con otra modificación.',
      );
  }
  throw error;
}

async function getRoadmapDtoUnsafe(identifier: CourseOfferingIdentifier, includeHidden = true) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { courseOffering: identifier },
    include: {
      courseOffering: { include: { course: true } },
      roadmapNodes: {
        orderBy: { title: 'asc' },
        include: { resources: { orderBy: { title: 'asc' } } },
      },
    },
  });

  if (!roadmap)
    throw new ApplicationError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  const dependencies = await prisma.dependency.findMany({
    where: { sourceNode: { roadmapId: roadmap.id } },
    orderBy: { id: 'asc' },
  });

  const nodes = includeHidden
    ? roadmap.roadmapNodes
    : roadmap.roadmapNodes.filter((node) => node.isVisible);
  const visibleNodeIds = new Set(nodes.map((node) => node.id));
  const visibleDependencies: {
    id: string;
    sourceNodeId: string;
    targetNodeId: string;
    sourceHandle: string;
    targetHandle: string;
  }[] = [];
  for (const dependency of dependencies) {
    if (
      includeHidden ||
      (visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId))
    ) {
      visibleDependencies.push({
        id: dependency.id,
        sourceNodeId: dependency.sourceNodeId,
        targetNodeId: dependency.targetNodeId,
        sourceHandle: dependency.sourceHandle,
        targetHandle: dependency.targetHandle,
      });
    }
  }
  return {
    course: {
      code: roadmap.courseOffering.course.code,
      name: roadmap.courseOffering.course.name,
      department: roadmap.courseOffering.course.department,
    },
    courseOffering: {
      id: roadmap.courseOffering.id,
      year: roadmap.courseOffering.year,
      semester: roadmap.courseOffering.semester,
    },
    roadmap: { id: roadmap.id, closedAt: roadmap.closedAt },
    nodeTypes: await getAvailableTypes(roadmap.id),
    nodes: nodes.map((node) => ({
      ...nodeDto(node),
      resources: node.resources.map((resource) => resourceDto(resource, identifier)),
    })),
    dependencies: visibleDependencies,
  };
}

/** The optional frozen version to copy, as `{ courseCode, year, semester }`. */
function parseCopySource(value: unknown): VersionIdentifier | undefined {
  if (value === undefined || value === null) return undefined;
  const source = value as JsonObject;
  if (
    typeof value !== 'object' ||
    Array.isArray(value) ||
    typeof source.courseCode !== 'string' ||
    !Number.isInteger(source.year) ||
    !Number.isInteger(source.semester)
  )
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      'source debe identificar una versión con courseCode, year y semester.',
    );
  return {
    courseCode: source.courseCode.trim(),
    year: source.year as number,
    semester: source.semester as number,
  };
}

/** Writes a frozen version's content into the new Roadmap, recording it as the source. */
async function persistRoadmapCopy(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  sourceRoadmapId: string,
  source: RoadmapCopySource,
) {
  const plan = planRoadmapCopy(source, roadmapId, randomUUID);
  await transaction.roadmap.update({ where: { id: roadmapId }, data: { sourceRoadmapId } });
  await transaction.nodeType.createMany({ data: plan.nodeTypes });
  await transaction.roadmapNode.createMany({ data: plan.nodes });
  await transaction.dependency.createMany({ data: plan.dependencies });
  await transaction.resource.createMany({ data: plan.resources });
}

/** Copies a frozen version of the same Course into the new Roadmap. */
async function copyFrozenVersion(
  transaction: Prisma.TransactionClient,
  identifier: CourseOfferingIdentifier,
  source: VersionIdentifier,
  roadmapId: string,
) {
  const missing = new ApplicationError(
    404,
    'VERSION_NOT_FOUND',
    'La versión solicitada no existe.',
  );
  if (source.courseCode !== identifier.courseCode) throw missing;
  const sourceRoadmap = await transaction.roadmap.findFirst({
    where: { courseOffering: source },
    select: {
      id: true,
      closedAt: true,
      nodeTypes: { select: { id: true, name: true, icon: true, color: true } },
      roadmapNodes: {
        select: {
          id: true,
          nodeTypeId: true,
          title: true,
          description: true,
          positionX: true,
          positionY: true,
          isVisible: true,
          resources: { select: { roadmapNodeId: true, title: true, url: true, type: true } },
        },
      },
    },
  });
  if (!sourceRoadmap) throw missing;
  if (!sourceRoadmap.closedAt)
    throw new ApplicationError(
      409,
      'VERSION_NOT_CLOSED',
      'Solo se puede copiar una versión cerrada.',
    );
  const dependencies = await transaction.dependency.findMany({
    where: { sourceNode: { roadmapId: sourceRoadmap.id } },
    select: { sourceNodeId: true, targetNodeId: true, sourceHandle: true, targetHandle: true },
  });
  await persistRoadmapCopy(transaction, roadmapId, sourceRoadmap.id, {
    customNodeTypes: sourceRoadmap.nodeTypes,
    nodes: sourceRoadmap.roadmapNodes,
    dependencies,
    resources: sourceRoadmap.roadmapNodes.flatMap(({ resources }) => resources),
  });
}

// El curso puede llegar sin descripción cuando ya está materializado desde
// U-Campus. En ese caso conserva el nombre y el departamento registrados.
async function createRoadmapUnsafe(
  identifier: CourseOfferingIdentifier,
  body: JsonObject,
  actor: { id: string; name?: string },
) {
  const courseBody =
    body.course && typeof body.course === 'object' && !Array.isArray(body.course)
      ? (body.course as JsonObject)
      : undefined;
  const source = parseCopySource(body.source);

  try {
    const creation = await prisma.$transaction(async (transaction) => {
      const [existingCourse, existingCourseOffering] = await Promise.all([
        transaction.course.findUnique({ where: { code: identifier.courseCode } }),
        transaction.courseOffering.findUnique({
          where: {
            courseCode_year_semester: identifier,
          },
          include: { roadmap: true },
        }),
      ]);
      if (existingCourseOffering?.roadmap)
        throw new ApplicationError(
          409,
          'ROADMAP_CONFLICT',
          'Ya existe un roadmap para este curso.',
        );
      const term = await transaction.academicTerm.findUnique({
        where: { year_semester: { year: identifier.year, semester: identifier.semester } },
      });
      const freezeDate = resolveRoadmapFreezeDate(
        identifier,
        term?.roadmapFreezeDate.toISOString().slice(0, 10) ?? null,
      );
      if (roadmapClosureInstant(freezeDate) <= new Date()) {
        throw new ApplicationError(
          409,
          'ROADMAP_CLOSED',
          'El período de este curso terminó. No se puede crear un roadmap.',
        );
      }
      const name =
        courseBody?.name === undefined && existingCourse
          ? existingCourse.name
          : requireString(courseBody?.name, 'name', 200);
      const department =
        courseBody?.department === undefined && existingCourse
          ? existingCourse.department
          : requireString(courseBody?.department, 'department', 200);
      const course = await transaction.course.upsert({
        where: { code: identifier.courseCode },
        update: { name, department },
        create: { code: identifier.courseCode, name, department },
      });
      const materializedCourseOffering =
        existingCourseOffering ??
        (await transaction.courseOffering.create({
          data: { courseCode: course.code, year: identifier.year, semester: identifier.semester },
        }));
      const [roadmap, recipients] = await Promise.all([
        transaction.roadmap.create({
          data: { courseOfferingId: materializedCourseOffering.id, creatorId: actor.id },
        }),
        transaction.participation.findMany({
          where: { courseOfferingId: materializedCourseOffering.id, isActive: true },
          select: { userId: true, user: { select: { name: true } } },
        }),
      ]);
      if (source) await copyFrozenVersion(transaction, identifier, source, roadmap.id);
      return {
        roadmap,
        courseOfferingId: materializedCourseOffering.id,
        courseName: course.name,
        recipients: recipients.map(({ userId, user }) => ({ userId, name: user.name })),
        occurredAt: new Date(),
      };
    });
    return {
      roadmap: creation.roadmap,
      availabilityNotice: {
        eventId: creation.roadmap.id,
        roadmapId: creation.roadmap.id,
        courseOfferingId: creation.courseOfferingId,
        courseCode: identifier.courseCode,
        year: identifier.year,
        semester: identifier.semester,
        courseName: creation.courseName,
        actorId: actor.id,
        actorName: actor.name ?? actor.id,
        occurredAt: creation.occurredAt,
        recipients: creation.recipients.filter(({ userId }) => userId !== actor.id),
      },
    };
  } catch (error) {
    handlePrismaError(error);
  }
}

export function requireRoadmap(identifier: CourseOfferingIdentifier) {
  return applicationResult(() => requireRoadmapUnsafe(identifier));
}

export function getRoadmapDto(identifier: CourseOfferingIdentifier, includeHidden = true) {
  return applicationResult(() => getRoadmapDtoUnsafe(identifier, includeHidden));
}

export function createRoadmap(
  identifier: CourseOfferingIdentifier,
  body: JsonObject,
  actor: { id: string; name?: string },
) {
  return applicationResult(() => createRoadmapUnsafe(identifier, body, actor));
}
