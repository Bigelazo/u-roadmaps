import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/shared/server/db';
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
  resourceDto,
  type CourseOfferingIdentifier,
} from '@/lib/roadmap-api';
import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
} from '@/lib/roadmap-access';
import { deleteUploadedFile } from '@/lib/resource-storage';

type JsonObject = Record<string, unknown>;
type EditorInput = { userId: string; identifier: CourseOfferingIdentifier };
type WithInput = EditorInput & { input: JsonObject };
type WithId = EditorInput & { id: string };

export type TeacherBlockOperation = 'BLOCK' | 'UNBLOCK' | 'BRANCH_UNLOCK';

type TeacherBlockPreview = {
  nodes: Array<{ id: string; title: string }>;
};

type StructuralDependency = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
};

function structuralDependencies(
  dependencies: readonly StructuralDependency[],
): StructuralDependency[] {
  return dependencies.map(({ id, sourceNodeId, targetNodeId }) => ({
    id,
    sourceNodeId,
    targetNodeId,
  }));
}

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

async function withSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  concurrentModification: () => ApiError,
) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (
        attempt < 2 &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2034'
      ) {
        continue;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034') {
        throw concurrentModification();
      }
      throw error;
    }
  }
  throw new Error('Serializable transaction retry limit reached.');
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
  return withSerializableTransaction(
    async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      const requestedVisibility =
        'isVisible' in input ? requireBoolean(input.isVisible, 'isVisible') : undefined;
      const data: {
        title?: string;
        description?: string | null;
        nodeTypeId?: string;
        positionX?: number;
        positionY?: number;
        isVisible?: boolean;
        isTeacherBlocked?: boolean;
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
      if (requestedVisibility !== undefined) data.isVisible = requestedVisibility;
      const hiddenAfterUpdate = requestedVisibility === false || !node.isVisible;
      if (Object.keys(data).length === 0)
        throw new ApiError(
          400,
          'INVALID_REQUEST',
          'Debe indicar al menos un campo para actualizar.',
        );
      const removedDependencies = hiddenAfterUpdate
        ? await transaction.dependency.findMany({
            where: {
              OR: [{ sourceNodeId: node.id }, { targetNodeId: node.id }],
            },
            select: { id: true, sourceNodeId: true, targetNodeId: true },
            orderBy: { id: 'asc' },
          })
        : [];
      if (hiddenAfterUpdate) data.isTeacherBlocked = false;
      if (removedDependencies.length > 0) {
        await transaction.dependency.deleteMany({
          where: {
            OR: [{ sourceNodeId: node.id }, { targetNodeId: node.id }],
          },
        });
      }
      const updated = await transaction.roadmapNode.update({
        where: { id: node.id },
        data,
        include: { resources: { orderBy: { title: 'asc' } } },
      });
      return {
        node: {
          ...nodeDto(updated),
          resources: updated.resources.map((resource) => resourceDto(resource, editor.identifier)),
        },
        ...(requestedVisibility !== undefined
          ? { dependencies: structuralDependencies(removedDependencies) }
          : {}),
      };
    },
    () => new ApiError(409, 'CONFLICT', 'La operación entra en conflicto con otra modificación.'),
  );
}

async function deleteRoadmapNodeUnsafe({ id, ...editor }: WithId) {
  const fileKeys = await prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const resources = await transaction.resource.findMany({
      where: { roadmapNodeId: node.id, fileKey: { not: null } },
      select: { fileKey: true },
    });
    await transaction.roadmapNode.delete({ where: { id: node.id } });
    return resources.flatMap(({ fileKey }) => (fileKey ? [fileKey] : []));
  });
  await Promise.all(fileKeys.map((fileKey) => deleteUploadedFile(fileKey).catch(() => undefined)));
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

type PreparedRoadmapDependency = {
  roadmapId: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle: string;
  targetHandle: string;
  sourceNode: { isTeacherBlocked: boolean };
  dependencies: Array<{ sourceNodeId: string; targetNodeId: string }>;
};

async function prepareRoadmapDependency(
  transaction: Prisma.TransactionClient,
  { input, ...editor }: WithInput,
): Promise<PreparedRoadmapDependency> {
  const roadmap = await requireEditorRoadmap(transaction, editor);
  const sourceNodeId = requireUuid(input.sourceNodeId, 'sourceNodeId');
  const targetNodeId = requireUuid(input.targetNodeId, 'targetNodeId');
  const sourceHandle = dependencyHandle(input.sourceHandle, 'sourceHandle', 'right');
  const targetHandle = dependencyHandle(input.targetHandle, 'targetHandle', 'left');
  if (sourceNodeId === targetNodeId)
    throw new ApiError(409, 'SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const [sourceNode, targetNode] = await Promise.all([
    requireNode(transaction, sourceNodeId, roadmap.id),
    requireNode(transaction, targetNodeId, roadmap.id),
  ]);
  if (!sourceNode.isVisible || !targetNode.isVisible) {
    throw new ApiError(
      403,
      'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
      'No se pueden crear dependencias con nodos ocultos.',
    );
  }
  const dependencies = await transaction.dependency.findMany({
    where: { sourceNode: { roadmapId: roadmap.id } },
    select: { sourceNodeId: true, targetNodeId: true },
  });
  if (
    dependencies.some(
      (dependency) =>
        dependency.sourceNodeId === sourceNodeId && dependency.targetNodeId === targetNodeId,
    )
  ) {
    throw new ApiError(409, 'DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
  }
  if (findCycle(dependencies, sourceNodeId, targetNodeId))
    throw new ApiError(409, 'DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
  return {
    roadmapId: roadmap.id,
    sourceNodeId,
    targetNodeId,
    sourceHandle,
    targetHandle,
    sourceNode,
    dependencies,
  };
}

async function teacherBlockedDependentNodes(
  transaction: Prisma.TransactionClient,
  {
    roadmapId,
    sourceNode,
    targetNodeId,
    dependencies,
  }: Pick<PreparedRoadmapDependency, 'roadmapId' | 'sourceNode' | 'targetNodeId' | 'dependencies'>,
) {
  if (!sourceNode.isTeacherBlocked) return [];
  const nodes = await transaction.roadmapNode.findMany({
    where: { roadmapId },
    select: { id: true, title: true, isVisible: true, isTeacherBlocked: true },
    orderBy: { title: 'asc' },
  });
  const visibleNodeIds = new Set(nodes.filter((node) => node.isVisible).map((node) => node.id));
  const visibleDependencies = dependencies.filter(
    (dependency) =>
      visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId),
  );
  const affectedNodeIds = new Set([
    targetNodeId,
    ...transitiveDependentNodeIds(visibleDependencies, targetNodeId),
  ]);
  return nodes
    .filter((node) => node.isVisible && !node.isTeacherBlocked && affectedNodeIds.has(node.id))
    .map(({ id, title }) => ({ id, title }));
}

async function createRoadmapDependencyUnsafe({ input, ...editor }: WithInput) {
  return withSerializableTransaction(
    async (transaction) => {
      const prepared = await prepareRoadmapDependency(transaction, { input, ...editor });
      const dependency = await transaction.dependency.create({
        data: {
          sourceNodeId: prepared.sourceNodeId,
          targetNodeId: prepared.targetNodeId,
          sourceHandle: prepared.sourceHandle,
          targetHandle: prepared.targetHandle,
        },
      });
      const nodes = await teacherBlockedDependentNodes(transaction, {
        ...prepared,
        dependencies: [
          ...prepared.dependencies,
          { sourceNodeId: prepared.sourceNodeId, targetNodeId: prepared.targetNodeId },
        ],
      });
      if (nodes.length > 0) {
        await transaction.roadmapNode.updateMany({
          where: { id: { in: nodes.map((node) => node.id) } },
          data: { isTeacherBlocked: true },
        });
      }
      return {
        dependency: {
          id: dependency.id,
          sourceNodeId: prepared.sourceNodeId,
          targetNodeId: prepared.targetNodeId,
          sourceHandle: prepared.sourceHandle,
          targetHandle: prepared.targetHandle,
        },
        nodes,
      };
    },
    () =>
      new ApiError(
        409,
        'DEPENDENCY_CONFLICT',
        'La dependencia entra en conflicto con otra modificación.',
      ),
  );
}

async function previewRoadmapDependencyUnsafe({ input, ...editor }: WithInput) {
  return prisma.$transaction(
    async (transaction) => {
      const prepared = await prepareRoadmapDependency(transaction, { input, ...editor });
      return {
        nodes: await teacherBlockedDependentNodes(transaction, prepared),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
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
      editor.identifier,
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
    return resourceDto(
      await transaction.resource.update({ where: { id: resource.id }, data }),
      editor.identifier,
    );
  });
}

type UploadedResourceInput = EditorInput & {
  id: string;
  title: string;
  fileKey: string;
  fileContentType: string | null;
};

async function createUploadedRoadmapResourceUnsafe({
  id,
  title,
  fileKey,
  fileContentType,
  ...editor
}: UploadedResourceInput) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
    const resource = await transaction.resource.create({
      data: {
        roadmapNodeId: node.id,
        title: requireString(title, 'title', 240),
        url: `https://files.u-roadmaps.invalid/${requireUuid(fileKey, 'fileKey')}`,
        type: 'FILE',
        fileKey,
        fileContentType,
      },
    });
    return resourceDto(resource, editor.identifier);
  });
}

async function deleteRoadmapResourceUnsafe({ id, ...editor }: WithId) {
  const fileKey = await prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const resource = await requireResource(transaction, requireUuid(id, 'resourceId'), roadmap.id);
    await transaction.resource.delete({ where: { id: resource.id } });
    return resource.fileKey;
  });
  if (fileKey) await deleteUploadedFile(fileKey).catch(() => undefined);
}

async function nodeVisibilityPreview(transaction: Prisma.TransactionClient, input: WithId) {
  const roadmap = await requireEditorRoadmap(transaction, input);
  const node = await requireNode(transaction, requireUuid(input.id, 'nodeId'), roadmap.id);
  const dependencies = await transaction.dependency.findMany({
    where: {
      OR: [{ sourceNodeId: node.id }, { targetNodeId: node.id }],
    },
    select: { id: true, sourceNodeId: true, targetNodeId: true },
    orderBy: { id: 'asc' },
  });
  return { dependencies: structuralDependencies(dependencies) };
}

async function previewNodeVisibilityUnsafe(input: WithId) {
  return prisma.$transaction((transaction) => nodeVisibilityPreview(transaction, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function teacherBlockPreview(
  transaction: Prisma.TransactionClient,
  { id, ...editor }: WithId & { operation: TeacherBlockOperation },
) {
  const roadmap = await requireEditorRoadmap(transaction, editor);
  const nodeId = requireUuid(id, 'nodeId');
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId: roadmap.id },
      select: { id: true, title: true, isVisible: true, isTeacherBlocked: true },
      orderBy: { title: 'asc' },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId: roadmap.id } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = nodeById.get(nodeId);
  if (!selectedNode)
    throw new ApiError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  if (!selectedNode.isVisible) {
    throw new ApiError(
      409,
      'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
      'Un nodo oculto no puede tener un bloqueo docente.',
    );
  }

  let changedNodeIds: Set<string>;
  if (editor.operation === 'BLOCK') {
    changedNodeIds = new Set(
      [nodeId, ...transitiveDependentNodeIds(dependencies, nodeId)].filter((candidateNodeId) => {
        const node = nodeById.get(candidateNodeId);
        return node?.isVisible && !node.isTeacherBlocked;
      }),
    );
  } else if (editor.operation === 'UNBLOCK') {
    if (!selectedNode.isTeacherBlocked) return { nodes: [] };
    const hasTeacherBlockedPrerequisite = [
      ...transitivePrerequisiteNodeIds(dependencies, nodeId),
    ].some((prerequisiteNodeId) => nodeById.get(prerequisiteNodeId)?.isTeacherBlocked);
    if (hasTeacherBlockedPrerequisite) {
      throw new ApiError(
        409,
        'TEACHER_BLOCKED_PREREQUISITE',
        'No se puede desbloquear el nodo mientras conserve un prerrequisito con bloqueo docente.',
      );
    }
    changedNodeIds = new Set([nodeId]);
  } else {
    changedNodeIds = eligibleBranchUnlockNodeIds({
      dependencies,
      teacherBlockedNodeIds: new Set(
        nodes.filter((node) => node.isTeacherBlocked).map((node) => node.id),
      ),
      rootNodeId: nodeId,
    });
  }

  return {
    nodes: nodes
      .filter((node) => changedNodeIds.has(node.id))
      .map(({ id: changedNodeId, title }) => ({ id: changedNodeId, title })),
  } satisfies TeacherBlockPreview;
}

async function previewTeacherBlockUnsafe(input: WithId & { operation: TeacherBlockOperation }) {
  return prisma.$transaction((transaction) => teacherBlockPreview(transaction, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function changeTeacherBlockUnsafe(input: WithId & { operation: TeacherBlockOperation }) {
  return withSerializableTransaction(
    async (transaction) => {
      const preview = await teacherBlockPreview(transaction, input);
      if (preview.nodes.length > 0) {
        await transaction.roadmapNode.updateMany({
          where: { id: { in: preview.nodes.map((node) => node.id) } },
          data: { isTeacherBlocked: input.operation === 'BLOCK' },
        });
      }
      return preview;
    },
    () => new ApiError(409, 'CONFLICT', 'La operación entra en conflicto con otra modificación.'),
  );
}

export function createRoadmapNode(input: WithInput) {
  return apiResult(() => createRoadmapNodeUnsafe(input));
}

export function updateRoadmapNode(input: WithId & { input: JsonObject }) {
  return apiResult(() => updateRoadmapNodeUnsafe(input));
}

export function previewNodeVisibility(input: WithId) {
  return apiResult(() => previewNodeVisibilityUnsafe(input));
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

export function previewRoadmapDependency(input: WithInput) {
  return apiResult(() => previewRoadmapDependencyUnsafe(input));
}

export function deleteRoadmapDependency(input: WithId) {
  return apiResult(() => deleteRoadmapDependencyUnsafe(input));
}

export function createRoadmapResource(input: WithId & { input: JsonObject }) {
  return apiResult(() => createRoadmapResourceUnsafe(input));
}

export function createUploadedRoadmapResource(input: UploadedResourceInput) {
  return apiResult(() => createUploadedRoadmapResourceUnsafe(input));
}

export function updateRoadmapResource(input: WithId & { input: JsonObject }) {
  return apiResult(() => updateRoadmapResourceUnsafe(input));
}

export function deleteRoadmapResource(input: WithId) {
  return apiResult(() => deleteRoadmapResourceUnsafe(input));
}

export function previewTeacherBlock(input: WithId & { operation: TeacherBlockOperation }) {
  return apiResult(() => previewTeacherBlockUnsafe(input));
}

export function changeTeacherBlock(input: WithId & { operation: TeacherBlockOperation }) {
  return apiResult(() => changeTeacherBlockUnsafe(input));
}
