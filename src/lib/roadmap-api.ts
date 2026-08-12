import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export type CoursePath = {
  ramo: string;
  anio: number;
  semestre: number;
};

type JsonObject = Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
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
      { error: { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) } },
      { status: error.status },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    let prismaError: {
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

export function parseCoursePath(
  params: { ramo: string; anio: string; semestre: string },
): CoursePath {
  const anio = Number(params.anio);
  const semestre = Number(params.semestre);

  if (!params.ramo.trim() || params.ramo.trim().length > 20 || !Number.isInteger(anio) || anio < 1 || !Number.isInteger(semestre) || ![1, 2].includes(semestre)) {
    throw new ApiError(400, 'INVALID_ACADEMIC_IDENTITY', 'El ramo, año y semestre no forman una identidad académica válida.');
  }

  return { ramo: params.ramo.trim(), anio, semestre };
}

export function normalizeName(name: string): string {
  return name.trim().toLocaleLowerCase('es-CL');
}

export function requireString(value: unknown, field: string, maxLength?: number): string {
  if (typeof value !== 'string' || !value.trim() || (maxLength !== undefined && value.trim().length > maxLength)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser un texto no vacío.`);
  }
  return value.trim();
}

export function optionalString(value: unknown, field: string, maxLength?: number): string | null | undefined {
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
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
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

export function requireResourceType(value: unknown): 'ARCHIVO' | 'ENLACE' | 'VIDEO' {
  if (value !== 'ARCHIVO' && value !== 'ENLACE' && value !== 'VIDEO') {
    throw new ApiError(400, 'INVALID_RESOURCE_TYPE', 'tipo debe ser ARCHIVO, ENLACE o VIDEO.');
  }
  return value;
}

export function requireUrl(value: unknown): string {
  const url = requireString(value, 'url');
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Unsupported URL scheme');
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

export async function requireRoadmap(path: CoursePath) {
  const roadmap = await prisma.roadmap.findFirst({
    where: {
      curso: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre },
    },
  });
  if (!roadmap) {
    throw new ApiError(404, 'ROADMAP_NOT_FOUND', 'El profesor todavía no ha creado un roadmap para este curso.');
  }
  return roadmap;
}

export async function requireNodeInRoadmap(nodeId: string, roadmapId: string) {
  const node = await prisma.nodo.findFirst({ where: { id: nodeId, roadmapId } });
  if (!node) throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  return node;
}

export async function requireTypeInRoadmap(typeId: string, roadmapId: string) {
  const type = await prisma.tipoNodo.findFirst({
    where: { id: typeId, OR: [{ predefinido: true }, { roadmapId }] },
  });
  if (!type) throw new ApiError(404, 'NODE_TYPE_NOT_FOUND', 'El tipo no existe o no está disponible en este roadmap.');
  return type;
}

export async function requireResourceInRoadmap(resourceId: string, roadmapId: string) {
  const resource = await prisma.recurso.findFirst({ where: { id: resourceId, nodo: { roadmapId } } });
  if (!resource) throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  return resource;
}

export function nodeDto(node: {
  id: string;
  titulo: string;
  descripcion: string | null;
  posX: number;
  posY: number;
  tipoNodoId: string;
  visible: boolean;
}) {
  return {
    id: node.id,
    titulo: node.titulo,
    descripcion: node.descripcion,
    posX: node.posX,
    posY: node.posY,
    typeId: node.tipoNodoId,
    visible: node.visible,
  };
}

export async function ensureTypeNameAvailable(name: string, roadmapId: string, excludedTypeId?: string) {
  const existing = await prisma.tipoNodo.findFirst({
    where: {
      nombreNormalizado: normalizeName(name),
      OR: [{ predefinido: true }, { roadmapId }],
      ...(excludedTypeId ? { NOT: { id: excludedTypeId } } : {}),
    },
  });
  if (existing) throw new ApiError(409, 'NODE_TYPE_NAME_CONFLICT', 'Ya existe un tipo disponible con ese nombre.');
}

export async function getAvailableTypes(roadmapId: string) {
  const [predefined, custom] = await Promise.all([
    prisma.tipoNodo.findMany({ where: { predefinido: true }, orderBy: { nombre: 'asc' } }),
    prisma.tipoNodo.findMany({ where: { roadmapId }, orderBy: { nombre: 'asc' } }),
  ]);
  return [...predefined, ...custom].map((type) => ({
    id: type.id,
    nombre: type.nombre,
    color: type.color,
    predefinido: type.predefinido,
  }));
}

export function handlePrismaError(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') throw new ApiError(409, 'CONFLICT', 'La operación entra en conflicto con un recurso existente.');
    if (error.code === 'P2025') throw new ApiError(404, 'NOT_FOUND', 'El recurso solicitado no existe.');
    if (error.code === 'P2034') throw new ApiError(409, 'CONFLICT', 'La operación entra en conflicto con otra modificación.');
  }
  throw error;
}

export async function getRoadmapDto(path: CoursePath) {
  const roadmap = await prisma.roadmap.findFirst({
    where: { curso: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre } },
    include: {
      curso: { include: { ramo: true } },
      tipos: { orderBy: [{ predefinido: 'desc' }, { nombre: 'asc' }] },
      nodos: {
        orderBy: { titulo: 'asc' },
        include: { recursos: { orderBy: { titulo: 'asc' } } },
      },
    },
  });

  if (!roadmap) throw new ApiError(404, 'ROADMAP_NOT_FOUND', 'El profesor todavía no ha creado un roadmap para este curso.');
  const dependencias = await prisma.dependencia.findMany({
    where: { sourceNode: { roadmapId: roadmap.id } },
    orderBy: { id: 'asc' },
  });

  return {
    ramo: {
      codigo: roadmap.curso.ramo.codigo,
      nombre: roadmap.curso.ramo.nombre,
      departamento: roadmap.curso.ramo.departamento,
    },
    curso: {
      id: roadmap.curso.id,
      anio: roadmap.curso.anio,
      semestre: roadmap.curso.semestre,
    },
    roadmap: { id: roadmap.id },
    tipos: await getAvailableTypes(roadmap.id),
    nodos: roadmap.nodos.map((node) => ({
      ...nodeDto(node),
      recursos: node.recursos.map((resource) => ({
        id: resource.id,
        titulo: resource.titulo,
        url: resource.url,
        tipo: resource.tipo,
      })),
    })),
    dependencias: dependencias.map((dependency) => ({
      id: dependency.id,
      sourceNodeId: dependency.sourceNodeId,
      targetNodeId: dependency.targetNodeId,
    })),
  };
}

export async function createRoadmap(path: CoursePath, body: JsonObject) {
  const ramoBody = body.ramo && typeof body.ramo === 'object' && !Array.isArray(body.ramo) ? body.ramo as JsonObject : undefined;
  const nombre = requireString(ramoBody?.nombre ?? body.nombreRamo ?? body.ramoNombre ?? body.nombre, 'nombreRamo', 200);
  const departamento = requireString(ramoBody?.departamento ?? body.departamento, 'departamento', 200);

  try {
    const roadmap = await prisma.$transaction(async (transaction) => {
      const existingCourse = await transaction.curso.findUnique({
        where: { ramoCodigo_anio_semestre: { ramoCodigo: path.ramo, anio: path.anio, semestre: path.semestre } },
        include: { roadmap: true },
      });
      if (existingCourse?.roadmap) throw new ApiError(409, 'ROADMAP_CONFLICT', 'Ya existe un roadmap para este curso.');
      const ramo = await transaction.ramo.upsert({
        where: { codigo: path.ramo },
        update: { nombre, departamento },
        create: { codigo: path.ramo, nombre, departamento },
      });
      const materializedCourse = existingCourse ?? await transaction.curso.create({
        data: { ramoCodigo: ramo.codigo, anio: path.anio, semestre: path.semestre },
      });
      return transaction.roadmap.create({ data: { cursoId: materializedCourse.id } });
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
