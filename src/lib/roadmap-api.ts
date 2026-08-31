import { Prisma } from '@/generated/prisma/client';
import { ResultAsync } from 'neverthrow';
import { unstable_rethrow } from 'next/navigation';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type CourseOfferingIdentifier = {
  courseCode: string;
  year: number;
  semester: number;
};

type JsonObject = Record<string, unknown>;

export type ApiErrorCode =
  | 'AUTH_CONFIGURATION_ERROR'
  | 'CONFLICT'
  | 'DEPENDENCY_CONFLICT'
  | 'DEPENDENCY_CYCLE'
  | 'DEPENDENCY_NOT_FOUND'
  | 'DEVELOPMENT_PERSONA_NOT_FOUND'
  | 'FORBIDDEN'
  | 'INTERNAL_ERROR'
  | 'INVALID_ACADEMIC_IDENTITY'
  | 'INVALID_AUTH_CALLBACK'
  | 'INVALID_COLOR'
  | 'INVALID_JSON'
  | 'INVALID_REQUEST'
  | 'INVALID_RESOURCE_TYPE'
  | 'INVALID_URL'
  | 'INVALID_VTI_CLAIMS'
  | 'NODE_NOT_FOUND'
  | 'NODE_TYPE_IN_USE'
  | 'NODE_TYPE_NAME_CONFLICT'
  | 'NODE_TYPE_NOT_FOUND'
  | 'NOT_FOUND'
  | 'PREREQUISITES_PENDING'
  | 'PREDEFINED_TYPE_IMMUTABLE'
  | 'RESOURCE_NOT_FOUND'
  | 'ROADMAP_CONFLICT'
  | 'ROADMAP_NOT_FOUND'
  | 'SELF_DEPENDENCY'
  | 'UNAUTHENTICATED';

const httpStatusByErrorCode = {
  AUTH_CONFIGURATION_ERROR: 500,
  CONFLICT: 409,
  DEPENDENCY_CONFLICT: 409,
  DEPENDENCY_CYCLE: 409,
  DEPENDENCY_NOT_FOUND: 404,
  DEVELOPMENT_PERSONA_NOT_FOUND: 404,
  FORBIDDEN: 403,
  INTERNAL_ERROR: 500,
  INVALID_ACADEMIC_IDENTITY: 400,
  INVALID_AUTH_CALLBACK: 400,
  INVALID_COLOR: 400,
  INVALID_JSON: 400,
  INVALID_REQUEST: 400,
  INVALID_RESOURCE_TYPE: 400,
  INVALID_URL: 400,
  INVALID_VTI_CLAIMS: 400,
  NODE_NOT_FOUND: 404,
  NODE_TYPE_IN_USE: 409,
  NODE_TYPE_NAME_CONFLICT: 409,
  NODE_TYPE_NOT_FOUND: 404,
  NOT_FOUND: 404,
  PREREQUISITES_PENDING: 409,
  PREDEFINED_TYPE_IMMUTABLE: 409,
  RESOURCE_NOT_FOUND: 404,
  ROADMAP_CONFLICT: 409,
  ROADMAP_NOT_FOUND: 404,
  SELF_DEPENDENCY: 409,
  UNAUTHENTICATED: 401,
} as const satisfies Record<ApiErrorCode, ApiError['status']>;

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 401 | 403 | 404 | 409 | 500,
    readonly code: ApiErrorCode,
    message: string,
    readonly details?: Record<string, unknown>,
    readonly source?: 'P2003',
  ) {
    super(message);
  }
}

function normalizeApiError(error: unknown): ApiError {
  unstable_rethrow(error);
  if (error instanceof ApiError) return error;
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return new ApiError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    }
    if (error.code === 'P2003') {
      return new ApiError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con datos relacionados.',
        undefined,
        'P2003',
      );
    }
    if (error.code === 'P2002' || error.code === 'P2034') {
      return new ApiError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con un recurso existente.',
      );
    }
  }

  console.error(error);
  return new ApiError(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado.');
}

export function apiErrorResponse(error: ApiError): NextResponse {
  return NextResponse.json(
    {
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    },
    { status: httpStatusByErrorCode[error.code] },
  );
}

export function apiResult<T>(operation: () => Promise<T>): ResultAsync<T, ApiError> {
  return ResultAsync.fromPromise(Promise.resolve().then(operation), normalizeApiError);
}

export function throwApiError(error: ApiError): never {
  throw error;
}

export function handleApiResult<T extends Response>(
  operation: () => Promise<T>,
  onError: (error: ApiError) => Response = apiErrorResponse,
): Promise<Response> {
  return apiResult(operation).match(
    (response) => response,
    (error) => onError(error),
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

async function requireRoadmapUnsafe(identifier: CourseOfferingIdentifier) {
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
        throw new ApiError(409, 'ROADMAP_CONFLICT', 'Ya existe un roadmap para este curso.');
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

export function requireRoadmap(identifier: CourseOfferingIdentifier) {
  return apiResult(() => requireRoadmapUnsafe(identifier));
}

export function getRoadmapDto(identifier: CourseOfferingIdentifier, includeHidden = true) {
  return apiResult(() => getRoadmapDtoUnsafe(identifier, includeHidden));
}

export function createRoadmap(identifier: CourseOfferingIdentifier, body: JsonObject) {
  return apiResult(() => createRoadmapUnsafe(identifier, body));
}
