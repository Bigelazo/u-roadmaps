import 'server-only';

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

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

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
    roadmap: { id: roadmap.id },
    nodeTypes: await getAvailableTypes(roadmap.id),
    nodes: nodes.map((node) => ({
      ...nodeDto(node),
      resources: node.resources.map((resource) => resourceDto(resource, identifier)),
    })),
    dependencies: visibleDependencies,
  };
}

// El curso puede llegar sin descripción cuando ya está materializado desde
// U-Campus. En ese caso conserva el nombre y el departamento registrados.
async function createRoadmapUnsafe(identifier: CourseOfferingIdentifier, body: JsonObject) {
  const courseBody =
    body.course && typeof body.course === 'object' && !Array.isArray(body.course)
      ? (body.course as JsonObject)
      : undefined;

  try {
    const roadmap = await prisma.$transaction(async (transaction) => {
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
      return transaction.roadmap.create({
        data: { courseOfferingId: materializedCourseOffering.id },
      });
    });
    return roadmap;
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

export function createRoadmap(identifier: CourseOfferingIdentifier, body: JsonObject) {
  return applicationResult(() => createRoadmapUnsafe(identifier, body));
}
