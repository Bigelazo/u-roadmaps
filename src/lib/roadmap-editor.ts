import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/db';
import {
  ApiError,
  apiResult,
  findCycle,
  nodeDto,
  normalizeName,
  optionalString,
  requireBoolean,
  requireColor,
  requireFiniteNumber,
  requireResourceType,
  requireString,
  requireUrl,
  requireUuid,
  type CourseOfferingIdentifier,
} from '@/lib/roadmap-api';

type JsonObject = Record<string, unknown>;
type EditorInput = { userId: string; identifier: CourseOfferingIdentifier };
type WithInput = EditorInput & { input: JsonObject };
type WithId = EditorInput & { id: string };

function dependencyHandle(value: unknown, field: string, fallback: string) {
  const handle = optionalString(value, field, 6) ?? fallback;
  if (!['top', 'right', 'bottom', 'left'].includes(handle)) {
    throw new ApiError(400, 'INVALID_REQUEST', `${field} debe ser un punto válido del nodo.`);
  }
  return handle;
}

async function requireEditorRoadmap(transaction: Prisma.TransactionClient, input: EditorInput) {
  const courseOffering = await transaction.courseOffering.findUnique({
    where: { courseCode_year_semester: input.identifier },
    include: { roadmap: true },
  });
  if (!courseOffering) {
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  const participation = await transaction.participation.findUnique({
    where: {
      userId_courseOfferingId: { userId: input.userId, courseOfferingId: courseOffering.id },
    },
  });
  if (!participation?.isActive || participation.role !== 'TEACHER') {
    throw new ApiError(403, 'FORBIDDEN', 'No tienes participación vigente para esta operación.');
  }
  if (!courseOffering.roadmap) {
    throw new ApiError(
      404,
      'ROADMAP_NOT_FOUND',
      'El profesor todavía no ha creado un roadmap para este curso.',
    );
  }
  return courseOffering.roadmap;
}

async function requireNode(transaction: Prisma.TransactionClient, id: string, roadmapId: string) {
  const node = await transaction.roadmapNode.findFirst({ where: { id, roadmapId } });
  if (!node) throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  return node;
}

async function requireType(transaction: Prisma.TransactionClient, id: string, roadmapId: string) {
  const nodeType = await transaction.nodeType.findFirst({
    where: { id, OR: [{ isPredefined: true }, { roadmapId }] },
  });
  if (!nodeType) {
    throw new ApiError(
      404,
      'NODE_TYPE_NOT_FOUND',
      'El tipo no existe o no está disponible en este roadmap.',
    );
  }
  return nodeType;
}

async function requireCustomType(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const nodeType = await requireType(transaction, id, roadmapId);
  if (nodeType.isPredefined) {
    throw new ApiError(409, 'PREDEFINED_TYPE_IMMUTABLE', 'Los tipos predefinidos son inmutables.');
  }
  return nodeType;
}

async function requireResource(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const resource = await transaction.resource.findFirst({
    where: { id, roadmapNode: { roadmapId } },
  });
  if (!resource)
    throw new ApiError(404, 'RESOURCE_NOT_FOUND', 'El recurso no existe en este roadmap.');
  return resource;
}

async function ensureTypeNameAvailable(
  transaction: Prisma.TransactionClient,
  name: string,
  roadmapId: string,
  excludedTypeId?: string,
) {
  const existing = await transaction.nodeType.findFirst({
    where: {
      normalizedName: normalizeName(name),
      OR: [{ isPredefined: true }, { roadmapId }],
      ...(excludedTypeId ? { NOT: { id: excludedTypeId } } : {}),
    },
  });
  if (existing) {
    throw new ApiError(
      409,
      'NODE_TYPE_NAME_CONFLICT',
      'Ya existe un tipo disponible con ese nombre.',
    );
  }
}

function resourceDto(resource: {
  id: string;
  title: string;
  url: string;
  type: 'FILE' | 'LINK' | 'VIDEO';
}) {
  return { id: resource.id, title: resource.title, url: resource.url, type: resource.type };
}

function typeDto(nodeType: { id: string; name: string; color: string; isPredefined: boolean }) {
  return {
    id: nodeType.id,
    name: nodeType.name,
    color: nodeType.color,
    isPredefined: nodeType.isPredefined,
  };
}

async function createRoadmapNodeUnsafe({ input, ...editor }: WithInput) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const title = requireString(input.title, 'title', 240);
    const description = optionalString(input.description, 'description');
    const nodeTypeId = requireUuid(input.nodeTypeId, 'nodeTypeId');
    const positionX = requireFiniteNumber(input.positionX, 'positionX');
    const positionY = requireFiniteNumber(input.positionY, 'positionY');
    const isVisible =
      input.isVisible === undefined ? true : requireBoolean(input.isVisible, 'isVisible');
    await requireType(transaction, nodeTypeId, roadmap.id);
    return nodeDto(
      await transaction.roadmapNode.create({
        data: {
          roadmapId: roadmap.id,
          nodeTypeId,
          title,
          description,
          positionX,
          positionY,
          isVisible,
        },
      }),
    );
  });
}

async function updateRoadmapNodeUnsafe({ id, input, ...editor }: WithId & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const data: {
      title?: string;
      description?: string | null;
      nodeTypeId?: string;
      positionX?: number;
      positionY?: number;
      isVisible?: boolean;
    } = {};
    if ('title' in input) data.title = requireString(input.title, 'title', 240);
    if ('description' in input)
      data.description = optionalString(input.description, 'description') ?? null;
    if ('nodeTypeId' in input) {
      data.nodeTypeId = requireUuid(input.nodeTypeId, 'nodeTypeId');
      await requireType(transaction, data.nodeTypeId, roadmap.id);
    }
    if ('positionX' in input) data.positionX = requireFiniteNumber(input.positionX, 'positionX');
    if ('positionY' in input) data.positionY = requireFiniteNumber(input.positionY, 'positionY');
    if ('isVisible' in input) data.isVisible = requireBoolean(input.isVisible, 'isVisible');
    if (Object.keys(data).length === 0)
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar al menos un campo para actualizar.');
    const updated = await transaction.roadmapNode.update({
      where: { id: node.id },
      data,
      include: { resources: { orderBy: { title: 'asc' } } },
    });
    return { ...nodeDto(updated), resources: updated.resources.map(resourceDto) };
  });
}

async function deleteRoadmapNodeUnsafe({ id, ...editor }: WithId) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    await transaction.roadmapNode.delete({ where: { id: node.id } });
  });
}

async function createRoadmapNodeTypeUnsafe({ input, ...editor }: WithInput) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const name = requireString(input.name, 'name', 120);
    const color = requireColor(input.color);
    await ensureTypeNameAvailable(transaction, name, roadmap.id);
    return typeDto(
      await transaction.nodeType.create({
        data: {
          roadmapId: roadmap.id,
          name,
          normalizedName: normalizeName(name),
          color,
          isPredefined: false,
        },
      }),
    );
  });
}

async function updateRoadmapNodeTypeUnsafe({
  id,
  input,
  ...editor
}: WithId & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const nodeType = await requireCustomType(transaction, requireUuid(id, 'typeId'), roadmap.id);
    const data: { name?: string; normalizedName?: string; color?: string } = {};
    if ('name' in input) {
      data.name = requireString(input.name, 'name', 120);
      data.normalizedName = normalizeName(data.name);
      await ensureTypeNameAvailable(transaction, data.name, roadmap.id, nodeType.id);
    }
    if ('color' in input) data.color = requireColor(input.color);
    if (Object.keys(data).length === 0)
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar nombre o color para actualizar.');
    return typeDto(await transaction.nodeType.update({ where: { id: nodeType.id }, data }));
  });
}

async function deleteRoadmapNodeTypeUnsafe({ id, ...editor }: WithId) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const nodeType = await requireCustomType(transaction, requireUuid(id, 'typeId'), roadmap.id);
    if (await transaction.roadmapNode.count({ where: { nodeTypeId: nodeType.id } })) {
      throw new ApiError(
        409,
        'NODE_TYPE_IN_USE',
        'No se puede eliminar un tipo utilizado por nodos.',
      );
    }
    await transaction.nodeType.delete({ where: { id: nodeType.id } });
  });
}

async function createRoadmapDependencyUnsafe({ input, ...editor }: WithInput) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(
        async (transaction) => {
          const roadmap = await requireEditorRoadmap(transaction, editor);
          const sourceNodeId = requireUuid(input.sourceNodeId, 'sourceNodeId');
          const targetNodeId = requireUuid(input.targetNodeId, 'targetNodeId');
          const sourceHandle = dependencyHandle(input.sourceHandle, 'sourceHandle', 'right');
          const targetHandle = dependencyHandle(input.targetHandle, 'targetHandle', 'left');
          if (sourceNodeId === targetNodeId)
            throw new ApiError(409, 'SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
          await requireNode(transaction, sourceNodeId, roadmap.id);
          await requireNode(transaction, targetNodeId, roadmap.id);
          const dependencies = await transaction.dependency.findMany({
            where: { sourceNode: { roadmapId: roadmap.id } },
            select: { sourceNodeId: true, targetNodeId: true },
          });
          if (
            dependencies.some(
              (dependency) =>
                dependency.sourceNodeId === sourceNodeId &&
                dependency.targetNodeId === targetNodeId,
            )
          ) {
            throw new ApiError(409, 'DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
          }
          if (findCycle(dependencies, sourceNodeId, targetNodeId))
            throw new ApiError(409, 'DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
          const dependency = await transaction.dependency.create({
            data: { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
          });
          return { id: dependency.id, sourceNodeId, targetNodeId, sourceHandle, targetHandle };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      )
        continue;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw new ApiError(
          409,
          'DEPENDENCY_CONFLICT',
          'La dependencia entra en conflicto con otra modificación.',
        );
      }
      throw error;
    }
  }
  throw new Error('Dependency transaction retry limit reached.');
}

async function deleteRoadmapDependencyUnsafe({ id, ...editor }: WithId) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const dependencyId = requireUuid(id, 'dependencyId');
    const dependency = await transaction.dependency.findFirst({
      where: { id: dependencyId, sourceNode: { roadmapId: roadmap.id } },
    });
    if (!dependency)
      throw new ApiError(404, 'DEPENDENCY_NOT_FOUND', 'La dependencia no existe en este roadmap.');
    await transaction.dependency.delete({ where: { id: dependency.id } });
  });
}

async function createRoadmapResourceUnsafe({
  id,
  input,
  ...editor
}: WithId & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const title = requireString(input.title, 'title', 240);
    const url = requireUrl(input.url);
    const type = requireResourceType(input.type);
    return resourceDto(
      await transaction.resource.create({ data: { roadmapNodeId: node.id, title, url, type } }),
    );
  });
}

async function updateRoadmapResourceUnsafe({
  id,
  input,
  ...editor
}: WithId & { input: JsonObject }) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    const data: { title?: string; url?: string; type?: 'FILE' | 'LINK' | 'VIDEO' } = {};
    if ('title' in input) data.title = requireString(input.title, 'title', 240);
    if ('url' in input) data.url = requireUrl(input.url);
    if ('type' in input) data.type = requireResourceType(input.type);
    if (Object.keys(data).length === 0)
      throw new ApiError(400, 'INVALID_REQUEST', 'Debe indicar al menos un campo para actualizar.');
    return resourceDto(await transaction.resource.update({ where: { id: resource.id }, data }));
  });
}

async function deleteRoadmapResourceUnsafe({ id, ...editor }: WithId) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    await transaction.resource.delete({ where: { id: resource.id } });
  });
}

export function createRoadmapNode(input: WithInput) {
  return apiResult(() => createRoadmapNodeUnsafe(input));
}

export function updateRoadmapNode(input: WithId & { input: JsonObject }) {
  return apiResult(() => updateRoadmapNodeUnsafe(input));
}

export function deleteRoadmapNode(input: WithId) {
  return apiResult(() => deleteRoadmapNodeUnsafe(input));
}

export function createRoadmapNodeType(input: WithInput) {
  return apiResult(() => createRoadmapNodeTypeUnsafe(input));
}

export function updateRoadmapNodeType(input: WithId & { input: JsonObject }) {
  return apiResult(() => updateRoadmapNodeTypeUnsafe(input));
}

export function deleteRoadmapNodeType(input: WithId) {
  return apiResult(() => deleteRoadmapNodeTypeUnsafe(input));
}

export function createRoadmapDependency(input: WithInput) {
  return apiResult(() => createRoadmapDependencyUnsafe(input));
}

export function deleteRoadmapDependency(input: WithId) {
  return apiResult(() => deleteRoadmapDependencyUnsafe(input));
}

export function createRoadmapResource(input: WithId & { input: JsonObject }) {
  return apiResult(() => createRoadmapResourceUnsafe(input));
}

export function updateRoadmapResource(input: WithId & { input: JsonObject }) {
  return apiResult(() => updateRoadmapResourceUnsafe(input));
}

export function deleteRoadmapResource(input: WithId) {
  return apiResult(() => deleteRoadmapResourceUnsafe(input));
}
