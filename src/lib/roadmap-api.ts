import { Prisma } from '@/generated/prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type CourseOfferingIdentifier = {
  courseCode: string;
  year: number;
  semester: number;
};

type JsonObject = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function apiErrorResponse(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          ...(error.details ? { details: error.details } : {}),
        },
      },
      { status: error.status },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError: {
      status: 404 | 409;
      code: string;
      message: string;
    } = {
      status: 409,
      code: 'CONFLICT',
      message: 'La operación entra en conflicto con un recurso existente.',
    };
    if (error.code === 'P2025') {
      prismaError.status = 404;
      prismaError.code = 'NOT_FOUND';
      prismaError.message = 'El recurso solicitado no existe.';
    } else if (error.code === 'P2003') {
      prismaError.message = 'La operación entra en conflicto con datos relacionados.';
    } else if (error.code !== 'P2002' && error.code !== 'P2034') {
      console.error(error);
      return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: prismaError }, { status: prismaError.status });
  }

  console.error(error);
  return NextResponse.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' } },
    { status: 500 },
  );
}

export function parseCourseOfferingIdentifier(params: {
  courseCode: string;
  year: string;
  semester: string;
}): CourseOfferingIdentifier {
  const year = Number(params.year);
  const semester = Number(params.semester);

  if (
    !params.courseCode.trim() ||
    params.courseCode.trim().length > 20 ||
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(semester) ||
    ![1, 2].includes(semester)
  ) {
    throw new ApiError(
      400,
      'INVALID_ACADEMIC_IDENTITY',
      'El ramo, año y semestre no forman una identidad académica válida.',
    );
  }

  return { courseCode: params.courseCode.trim(), year, semester };
}

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

export function requireString(value: unknown, field: string, maxLength?: number): string {
  if (
    typeof value !== 'string' ||
    !value.trim() ||
    (maxLength !== undefined && value.trim().length > maxLength)
  ) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser un texto no vacío.`);
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
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser un número finito.`);
  }
  return value;
}

export function requireBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser booleano.`);
  }
  return value;
}

export function requireUuid(value: unknown, field: string): string {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  ) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser un UUID válido.`);
  }
  return value;
}

export function requireColor(value: unknown): string {
  const color = requireString(value, 'color');
  if (!/^#[0-9A-Fa-f]{6}$/.test(color)) {
    throw new ApiError(400, 'INVALID_COLOR', 'color debe tener el formato hexadecimal #RRGGBB.');
  }
  return color.toUpperCase();
}

export function requireResourceType(value: unknown): 'FILE' | 'LINK' | 'VIDEO' {
  if (value !== 'FILE' && value !== 'LINK' && value !== 'VIDEO') {
    throw new ApiError(400, 'INVALID_RESOURCE_TYPE', 'type debe ser FILE, LINK o VIDEO.');
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
    throw new ApiError(400, 'INVALID_URL', 'url debe ser una URL válida.');
  }
  return url;
}

export async function parseJson(request: Request): Promise<JsonObject> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'El cuerpo debe ser JSON válido.');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiError(400, 'INVALID_REQUEST', 'El cuerpo debe ser un objeto JSON.');
  }
  return body as JsonObject;
}

export async function requireRoadmap(identifier: CourseOfferingIdentifier) {
  const roadmap = await prisma.roadmap.findFirst({
    where: {
      courseOffering: identifier,
    },
  });
  if (!roadmap) {
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return roadmap;
}

export async function requireNodeInRoadmap(nodeId: string, roadmapId: string) {
  const node = await prisma.roadmapNode.findFirst({ where: { id: nodeId, roadmapId } });
  if (!node) throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  return node;
}

export async function requireTypeInRoadmap(typeId: string, roadmapId: string) {
  const type = await prisma.nodeType.findFirst({
    where: { id: typeId, OR: [{ isPredefined: true }, { roadmapId }] },
  });
  if (!type)
    throw new ApiError(
      404,
      'NODE_TYPE_NOT_FOUND',
      'El tipo no existe o no está disponible en este roadmap.',
    );
  return type;
}

export async function requireResourceInRoadmap(resourceId: string, roadmapId: string) {
  const resource = await prisma.resource.findFirst({
    where: { id: resourceId, roadmapNode: { roadmapId } },
  });
  if (!resource)
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  return resource;
}

export function nodeDto(node: {
  id: string;
  title: string;
  description: string | null;
  positionX: number;
  positionY: number;
  nodeTypeId: string;
  isVisible: boolean;
}) {
  return {
    id: node.id,
    title: node.title,
    description: node.description,
    positionX: node.positionX,
    positionY: node.positionY,
    nodeTypeId: node.nodeTypeId,
    isVisible: node.isVisible,
  };
}

export async function ensureTypeNameAvailable(
  name: string,
  roadmapId: string,
  excludedTypeId?: string,
) {
  const existing = await prisma.nodeType.findFirst({
    where: {
      normalizedName: normalizeName(name),
      OR: [{ isPredefined: true }, { roadmapId }],
      ...(excludedTypeId ? { NOT: { id: excludedTypeId } } : {}),
    },
  });
  if (existing)
    throw new ApiError(
      409,
      'NODE_TYPE_NAME_CONFLICT',
      'Ya existe un tipo disponible con ese nombre.',
    );
}

export async function getAvailableTypes(roadmapId: string) {
  const [predefined, custom] = await Promise.all([
    prisma.nodeType.findMany({ where: { isPredefined: true }, orderBy: { name: 'asc' } }),
    prisma.nodeType.findMany({ where: { roadmapId }, orderBy: { name: 'asc' } }),
  ]);
  return [...predefined, ...custom].map((type) => ({
    id: type.id,
    name: type.name,
    color: type.color,
    isPredefined: type.isPredefined,
  }));
}

export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new ApiError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con un recurso existente.',
      );
    if (error.code === 'P2025')
      throw new ApiError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    if (error.code === 'P2034')
      throw new ApiError(409, 'CONFLICT', 'La operación entra en conflicto con otra modificación.');
  }
  throw error;
}

export async function getRoadmapDto(identifier: CourseOfferingIdentifier, includeHidden = true) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { courseOffering: identifier },
    include: {
      courseOffering: { include: { course: true } },
      nodeTypes: { orderBy: [{ isPredefined: 'desc' }, { name: 'asc' }] },
      roadmapNodes: {
        orderBy: { title: 'asc' },
        include: { resources: { orderBy: { title: 'asc' } } },
      },
    },
  });

  if (!roadmap)
    throw new ApiError(
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
      resources: node.resources.map((resource) => ({
        id: resource.id,
        title: resource.title,
        url: resource.url,
        type: resource.type,
      })),
    })),
    dependencies: dependencies
      .filter(
        (dependency) =>
          includeHidden ||
          (visibleNodeIds.has(dependency.sourceNodeId) &&
            visibleNodeIds.has(dependency.targetNodeId)),
      )
      .map((dependency) => ({
        id: dependency.id,
        sourceNodeId: dependency.sourceNodeId,
        targetNodeId: dependency.targetNodeId,
      })),
  };
}

export async function createRoadmap(identifier: CourseOfferingIdentifier, body: JsonObject) {
  const courseBody =
    body.course && typeof body.course === 'object' && !Array.isArray(body.course)
      ? (body.course as JsonObject)
      : undefined;
  const name = requireString(courseBody?.name, 'name', 200);
  const department = requireString(courseBody?.department, 'department', 200);

  try {
    const roadmap = await prisma.$transaction(async (transaction) => {
      const existingCourseOffering = await transaction.courseOffering.findUnique({
        where: {
          courseCode_year_semester: identifier,
        },
        include: { roadmap: true },
      });
      if (existingCourseOffering?.roadmap)
        throw new ApiError(409, 'ROADMAP_CONFLICT', 'Ya existe un roadmap para este curso.');
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

export function findCycle(
  dependencies: Array<{ sourceNodeId: string; targetNodeId: string }>,
  sourceNodeId: string,
  targetNodeId: string,
): boolean {
  const outgoing = new Map<string, string[]>();
  for (const dependency of dependencies) {
    const targets = outgoing.get(dependency.sourceNodeId) ?? [];
    targets.push(dependency.targetNodeId);
    outgoing.set(dependency.sourceNodeId, targets);
  }
  const pending = [targetNodeId];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || visited.has(current)) continue;
    if (current === sourceNodeId) return true;
    visited.add(current);
    pending.push(...(outgoing.get(current) ?? []));
  }
  return false;
}
