import { dependencyTarget, nodeTypeNameTarget } from '@/shared/route-notice-target';
import { captureRouteNoticeKnowledge } from './route-notice-knowledge';
import { captureAccessSnapshot } from './access-snapshot';
import 'server-only';

import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Prisma, prisma } from '@/shared/server/db';
import {
  findCycle,
  nodeDto,
  nodeDescription,
  normalizeName,
  optionalString,
  requireBoolean,
  requireNodeTypeColor,
  requireNodeTypeIcon,
  requireFiniteNumber,
  requireString,
  resourceDto,
} from '@/features/roadmap/application/roadmap';
import { requireUuid } from '@/shared/validation';
import { ApplicationError, applicationResult } from '@/shared/errors/server';
import type {
  NodeDeletionImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import { decideTeacherBlock } from '@/features/roadmap/domain/teacher-block';
import { transitiveDependentNodeIds } from '@/features/roadmap/domain/access';
import {
  chileCalendarDay,
  dueScheduledUnlockNodeIds,
  InvalidScheduledUnlockDay,
  requireScheduledUnlockDay,
  type CalendarDay,
} from '@/features/roadmap/domain/scheduled-unlock';
import {
  requireEditorRoadmap,
  requireNode,
  type EditorInput,
} from '@/features/roadmap/application/editor-access';
import { deleteUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';
import { dependencyChangeNotifications } from '@/features/roadmap/application/dependency-change-notifications';
import { nodeTypeClassificationNotification } from '@/features/roadmap/application/node-type-classification-notifications';
import {
  accessTransitionNotifications,
  visibilityNotifications,
} from '@/features/roadmap/application/node-change-notifications';

type JsonObject = Record<string, unknown>;

/** Nil UUID: no participant matches it, so every affected participant is notified. */
export const SCHEDULED_UNLOCK_ACTOR_ID = '00000000-0000-0000-0000-000000000000';
type WithInput = EditorInput & { input: JsonObject };
type WithId = EditorInput & { id: string };
type WithTeacherBlockOperation = WithId & {
  operation: TeacherBlockOperation;
  previewVersion?: string;
};
type WithDeletePreview = WithId & { previewVersion?: string };
type WithTeacherUnlockSchedule = WithId & { unlockOn: unknown };

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
    throw new ApplicationError(
      400,
      'INVALID_REQUEST',
      `${field} debe ser un punto válido del nodo.`,
    );
  }
  return handle;
}

async function requireType(transaction: Prisma.TransactionClient, id: string, roadmapId: string) {
  const nodeType = await transaction.nodeType.findFirst({
    where: { id, OR: [{ isPredefined: true }, { roadmapId }] },
  });
  if (!nodeType) {
    throw new ApplicationError(
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
    throw new ApplicationError(
      409,
      'PREDEFINED_TYPE_IMMUTABLE',
      'Los tipos predefinidos son inmutables.',
    );
  }
  return nodeType;
}

async function withSerializableTransaction<T>(
  operation: (transaction: Prisma.TransactionClient) => Promise<T>,
  concurrentModification: () => ApplicationError,
) {
  const maxAttempts = 5;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });
    } catch (error) {
      if (!isTransactionWriteConflict(error)) throw error;
      if (attempt === maxAttempts - 1) throw concurrentModification();
      // Separate attempts so unrelated concurrent Roadmaps can finish their writes.
      await delay(50 * 2 ** attempt + Math.random() * 50);
    }
  }
  throw new Error('Serializable transaction retry limit reached.');
}

function isTransactionWriteConflict(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) return error.code === 'P2034';
  // The pg adapter can expose serialization failures directly when COMMIT fails.
  return (
    error instanceof Error &&
    error.name === 'DriverAdapterError' &&
    typeof error.cause === 'object' &&
    error.cause !== null &&
    'kind' in error.cause &&
    error.cause.kind === 'TransactionWriteConflict'
  );
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
    throw new ApplicationError(
      409,
      'NODE_TYPE_NAME_CONFLICT',
      'Ya existe un tipo disponible con ese nombre.',
    );
  }
}

function typeDto(nodeType: {
  id: string;
  name: string;
  icon: string;
  color: string;
  isPredefined: boolean;
}) {
  return {
    id: nodeType.id,
    name: nodeType.name,
    icon: nodeType.icon,
    color: nodeType.color,
    isPredefined: nodeType.isPredefined,
  };
}

async function createRoadmapNodeUnsafe({ input, ...editor }: WithInput) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const title = requireString(input.title, 'title', 240);
    const description = nodeDescription(input.description);
    const nodeTypeId = requireUuid(input.nodeTypeId, 'nodeTypeId');
    const positionX = requireFiniteNumber(input.positionX, 'positionX');
    const positionY = requireFiniteNumber(input.positionY, 'positionY');
    const isVisible =
      input.isVisible === undefined ? true : requireBoolean(input.isVisible, 'isVisible');
    await requireType(transaction, nodeTypeId, roadmap.id);
    const node = await transaction.roadmapNode.create({
      data: {
        roadmapId: roadmap.id,
        nodeTypeId,
        title,
        description,
        positionX,
        positionY,
        isVisible,
      },
    });
    const recipients = await transaction.participation.findMany({
      where: {
        courseOfferingId: roadmap.courseOfferingId,
        isActive: true,
        userId: { not: editor.userId },
      },
      select: { userId: true },
    });
    await transaction.nodeLifecycleKnowledge.createMany({
      data: recipients.map(({ userId }) => ({
        recipientId: userId,
        roadmapId: roadmap.id,
        nodeId: node.id,
        isKnown: false,
      })),
      skipDuplicates: true,
    });
    return nodeDto(node);
  });
}

async function updateRoadmapNodeUnsafe({ id, input, ...editor }: WithId & { input: JsonObject }) {
  return withSerializableTransaction(
    async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      const requestedVisibility =
        'isVisible' in input ? requireBoolean(input.isVisible, 'isVisible') : undefined;
      const beforeVisibility =
        requestedVisibility === undefined
          ? null
          : await captureAccessSnapshot(transaction, roadmap.id);
      const data: {
        title?: string;
        description?: string | null;
        nodeTypeId?: string;
        positionX?: number;
        positionY?: number;
        isVisible?: boolean;
        isTeacherBlocked?: boolean;
        teacherUnlockOn?: null;
      } = {};
      if ('title' in input) data.title = requireString(input.title, 'title', 240);
      if ('description' in input) data.description = nodeDescription(input.description) ?? null;
      if ('nodeTypeId' in input) {
        data.nodeTypeId = requireUuid(input.nodeTypeId, 'nodeTypeId');
        await requireType(transaction, data.nodeTypeId, roadmap.id);
      }
      if ('positionX' in input) data.positionX = requireFiniteNumber(input.positionX, 'positionX');
      if ('positionY' in input) data.positionY = requireFiniteNumber(input.positionY, 'positionY');
      if (requestedVisibility !== undefined) data.isVisible = requestedVisibility;
      const hiddenAfterUpdate = requestedVisibility === false || !node.isVisible;
      if (Object.keys(data).length === 0)
        throw new ApplicationError(
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
      if (hiddenAfterUpdate) {
        data.isTeacherBlocked = false;
        data.teacherUnlockOn = null;
      }
      if (removedDependencies.length > 0) {
        await transaction.dependency.deleteMany({
          where: {
            OR: [{ sourceNodeId: node.id }, { targetNodeId: node.id }],
          },
        });
      }
      if (
        node.isVisible &&
        data.isVisible !== false &&
        data.description !== undefined &&
        data.description !== node.description
      ) {
        // Capture only descriptions these recipients can see, atomically with
        // the edit; a blocked recipient has no baseline for this content yet.
        const access = beforeVisibility ?? (await captureAccessSnapshot(transaction, roadmap.id));
        const recipients = access.participants.filter(({ userId }) =>
          access.accessibleByUser.get(userId)?.has(node.id),
        );
        if (recipients.length)
          await transaction.nodeContentKnowledge.createMany({
            data: recipients.map(({ userId }) => ({
              recipientId: userId,
              nodeId: node.id,
              target: 'description',
              knownValue: JSON.stringify(node.description),
            })),
            skipDuplicates: true,
          });
      }
      const updated = await transaction.roadmapNode.update({
        where: { id: node.id },
        data,
        include: { resources: { orderBy: { title: 'asc' } } },
      });
      const [previousType, currentType] =
        data.nodeTypeId && data.nodeTypeId !== node.nodeTypeId
          ? await Promise.all([
              requireType(transaction, node.nodeTypeId, roadmap.id),
              requireType(transaction, data.nodeTypeId, roadmap.id),
            ])
          : [null, null];
      const changedFields = [
        data.title !== undefined && data.title !== node.title ? 'title' : null,
        data.description !== undefined && data.description !== node.description
          ? 'description'
          : null,
        data.nodeTypeId !== undefined && data.nodeTypeId !== node.nodeTypeId ? 'nodeType' : null,
      ].filter((field): field is 'title' | 'description' | 'nodeType' => field !== null);
      const notifications =
        beforeVisibility && requestedVisibility !== node.isVisible
          ? visibilityNotifications({
              before: beforeVisibility,
              after: await captureAccessSnapshot(transaction, roadmap.id),
              actorId: editor.userId,
              targetNodeId: node.id,
              targetChange: requestedVisibility ? 'node-available' : 'node-retired',
              roadmapId: roadmap.id,
            })
          : [];
      return {
        node: {
          ...nodeDto(updated),
          resources: updated.resources.map((resource) => resourceDto(resource, editor.identifier)),
        },
        ...(node.isVisible && updated.isVisible && changedFields.length > 0
          ? {
              notification: {
                kind: 'node-updated' as const,
                changedFields,
                ...(changedFields.includes('title') ? { previousTitle: node.title } : {}),
                ...(changedFields.includes('description')
                  ? { previousDescription: node.description }
                  : {}),
                ...(previousType && currentType
                  ? {
                      previousTypeId: previousType.id,
                      previousTypeName: previousType.name,
                      currentTypeName: currentType.name,
                    }
                  : {}),
              },
            }
          : {}),
        ...(requestedVisibility !== undefined
          ? { dependencies: structuralDependencies(removedDependencies) }
          : {}),
        ...(notifications.length ? { notifications } : {}),
      };
    },
    () =>
      new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con otra modificación.',
      ),
  );
}

async function nodeDeletionPreview(
  transaction: Prisma.TransactionClient,
  { id, ...editor }: WithId,
): Promise<NodeDeletionImpact> {
  const roadmap = await requireEditorRoadmap(transaction, editor);
  const node = await transaction.roadmapNode.findFirst({
    where: { id: requireUuid(id, 'nodeId'), roadmapId: roadmap.id },
    include: {
      nodeType: { select: { name: true, icon: true, color: true } },
      resources: { select: { id: true, title: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!node)
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  const dependencies = await transaction.dependency.findMany({
    where: { OR: [{ sourceNodeId: node.id }, { targetNodeId: node.id }] },
    select: {
      id: true,
      sourceNode: { select: { title: true } },
      targetNode: { select: { title: true } },
    },
    orderBy: { id: 'asc' },
  });
  const impact = {
    node: {
      title: node.title,
      nodeType: node.nodeType,
    },
    dependencies: dependencies.map((dependency) => ({
      id: dependency.id,
      sourceTitle: dependency.sourceNode.title,
      targetTitle: dependency.targetNode.title,
    })),
    resources: node.resources,
  };
  return {
    ...impact,
    version: createHash('sha256').update(JSON.stringify(impact)).digest('base64url'),
  };
}

async function previewNodeDeletionUnsafe(input: WithId) {
  return prisma.$transaction((transaction) => nodeDeletionPreview(transaction, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function deleteRoadmapNodeUnsafe({ id, previewVersion, ...editor }: WithDeletePreview) {
  const deletion = await withSerializableTransaction(
    async (transaction) => {
      const preview = await nodeDeletionPreview(transaction, { id, ...editor });
      if (previewVersion && previewVersion !== preview.version) {
        throw new ApplicationError(
          409,
          'NODE_DELETE_PREVIEW_STALE',
          'El impacto de la eliminación cambió. Revisa y confirma la previsualización actualizada.',
        );
      }
      const [resources, roadmap] = await Promise.all([
        transaction.resource.findMany({
          where: { roadmapNodeId: requireUuid(id, 'nodeId'), fileKey: { not: null } },
          select: { fileKey: true },
        }),
        requireEditorRoadmap(transaction, editor),
      ]);
      const before = await captureAccessSnapshot(transaction, roadmap.id);
      await transaction.roadmapNode.delete({ where: { id: requireUuid(id, 'nodeId') } });
      const after = await captureAccessSnapshot(transaction, roadmap.id);
      return {
        fileKeys: resources.flatMap(({ fileKey }) => (fileKey ? [fileKey] : [])),
        notifications: visibilityNotifications({
          before,
          after,
          actorId: editor.userId,
          targetNodeId: id,
          targetChange: before.nodes.some((node) => node.id === id && node.isVisible)
            ? 'node-deleted'
            : undefined,
          roadmapId: roadmap.id,
        }),
      };
    },
    () =>
      new ApplicationError(
        409,
        'CONFLICT',
        'La eliminación entra en conflicto con otra modificación.',
      ),
  );
  await Promise.all(
    deletion.fileKeys.map((fileKey) => deleteUploadedFile(fileKey).catch(() => undefined)),
  );
  return { notifications: deletion.notifications };
}

async function createRoadmapNodeTypeUnsafe({ input, ...editor }: WithInput) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const name = requireString(input.name, 'name', 120);
    const icon = requireNodeTypeIcon(input.icon);
    const color = requireNodeTypeColor(input.color);
    await ensureTypeNameAvailable(transaction, name, roadmap.id);
    return typeDto(
      await transaction.nodeType.create({
        data: {
          roadmapId: roadmap.id,
          name,
          normalizedName: normalizeName(name),
          icon,
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
    const data: { name?: string; normalizedName?: string; icon?: string; color?: string } = {};
    if ('name' in input) {
      data.name = requireString(input.name, 'name', 120);
      data.normalizedName = normalizeName(data.name);
      await ensureTypeNameAvailable(transaction, data.name, roadmap.id, nodeType.id);
    }
    if ('icon' in input) data.icon = requireNodeTypeIcon(input.icon);
    if ('color' in input) data.color = requireNodeTypeColor(input.color);
    if (Object.keys(data).length === 0)
      throw new ApplicationError(
        400,
        'INVALID_REQUEST',
        'Debe indicar nombre, ícono o color para actualizar.',
      );
    const updated = await transaction.nodeType.update({ where: { id: nodeType.id }, data });
    let notification: ReturnType<typeof nodeTypeClassificationNotification> | undefined;
    if (data.name !== undefined && data.name !== nodeType.name) {
      const visibleNodeCount = await transaction.roadmapNode.count({
        where: { roadmapId: roadmap.id, nodeTypeId: nodeType.id, isVisible: true },
      });
      if (visibleNodeCount > 0) {
        const participants = await transaction.participation.findMany({
          where: { courseOfferingId: roadmap.courseOfferingId, isActive: true },
          select: { userId: true, isActive: true },
        });
        notification = nodeTypeClassificationNotification({
          nodeTypeId: nodeType.id,
          roadmapId: roadmap.id,
          previousTypeName: nodeType.name,
          nextTypeName: updated.name,
          visibleNodeCount,
          actorId: editor.userId,
          participants,
        });
      }
    }
    if (notification)
      await captureRouteNoticeKnowledge(
        transaction,
        roadmap.id,
        notification.recipientIds,
        nodeTypeNameTarget(nodeType.id),
        nodeType.name,
      );
    return {
      nodeType: typeDto(updated),
      ...(notification ? { notification } : {}),
    };
  });
}

async function deleteRoadmapNodeTypeUnsafe({ id, ...editor }: WithId) {
  return prisma.$transaction(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, editor);
    const nodeType = await requireCustomType(transaction, requireUuid(id, 'typeId'), roadmap.id);
    if (await transaction.roadmapNode.count({ where: { nodeTypeId: nodeType.id } })) {
      throw new ApplicationError(
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
  sourceNode: { title: string; isVisible: boolean; isTeacherBlocked: boolean };
  targetNode: { title: string; isVisible: boolean };
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
    throw new ApplicationError(409, 'SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const [sourceNode, targetNode] = await Promise.all([
    requireNode(transaction, sourceNodeId, roadmap.id),
    requireNode(transaction, targetNodeId, roadmap.id),
  ]);
  if (!sourceNode.isVisible || !targetNode.isVisible) {
    throw new ApplicationError(
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
    throw new ApplicationError(409, 'DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
  }
  if (findCycle(dependencies, sourceNodeId, targetNodeId))
    throw new ApplicationError(409, 'DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
  return {
    roadmapId: roadmap.id,
    sourceNodeId,
    targetNodeId,
    sourceHandle,
    targetHandle,
    sourceNode,
    targetNode,
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
  const visibleNodeIds = nodes.reduce<Set<string>>((ids, node) => {
    if (node.isVisible) ids.add(node.id);
    return ids;
  }, new Set());
  const visibleDependencies = dependencies.filter(
    (dependency) =>
      visibleNodeIds.has(dependency.sourceNodeId) && visibleNodeIds.has(dependency.targetNodeId),
  );
  const affectedNodeIds = new Set([
    targetNodeId,
    ...transitiveDependentNodeIds(visibleDependencies, targetNodeId),
  ]);
  return nodes.reduce<Array<{ id: string; title: string }>>((affectedNodes, node) => {
    if (node.isVisible && !node.isTeacherBlocked && affectedNodeIds.has(node.id)) {
      affectedNodes.push({ id: node.id, title: node.title });
    }
    return affectedNodes;
  }, []);
}

async function createRoadmapDependencyUnsafe({ input, ...editor }: WithInput) {
  return withSerializableTransaction(
    async (transaction) => {
      const prepared = await prepareRoadmapDependency(transaction, { input, ...editor });
      const [nodes, { before, dependency }] = await Promise.all([
        teacherBlockedDependentNodes(transaction, {
          ...prepared,
          dependencies: [
            ...prepared.dependencies,
            { sourceNodeId: prepared.sourceNodeId, targetNodeId: prepared.targetNodeId },
          ],
        }),
        (async () => {
          const before = await captureAccessSnapshot(transaction, prepared.roadmapId);
          return {
            before,
            dependency: await transaction.dependency.create({
              data: {
                sourceNodeId: prepared.sourceNodeId,
                targetNodeId: prepared.targetNodeId,
                sourceHandle: prepared.sourceHandle,
                targetHandle: prepared.targetHandle,
              },
            }),
          };
        })(),
      ]);
      if (nodes.length > 0) {
        await transaction.roadmapNode.updateMany({
          where: { id: { in: nodes.map((node) => node.id) } },
          data: { isTeacherBlocked: true },
        });
      }
      const after = await captureAccessSnapshot(transaction, prepared.roadmapId);
      await captureRouteNoticeKnowledge(
        transaction,
        prepared.roadmapId,
        after.participants
          .filter(({ userId }) => userId !== editor.userId)
          .map(({ userId }) => userId),
        dependencyTarget(prepared.sourceNodeId, prepared.targetNodeId),
        'false',
      );
      return {
        dependency: {
          id: dependency.id,
          sourceNodeId: prepared.sourceNodeId,
          targetNodeId: prepared.targetNodeId,
          sourceHandle: prepared.sourceHandle,
          targetHandle: prepared.targetHandle,
        },
        nodes,
        notifications: dependencyChangeNotifications({
          before,
          after,
          actorId: editor.userId,
          dependencyId: dependency.id,
          sourceNodeId: prepared.sourceNodeId,
          targetNodeId: prepared.targetNodeId,
          roadmapId: prepared.roadmapId,
          changeKind: 'dependency-added',
          sourceNode: prepared.sourceNode,
          targetNode: prepared.targetNode,
        }),
      };
    },
    () =>
      new ApplicationError(
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
  return withSerializableTransaction(
    async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const dependencyId = requireUuid(id, 'dependencyId');
      const dependency = await transaction.dependency.findFirst({
        where: { id: dependencyId, sourceNode: { roadmapId: roadmap.id } },
        include: {
          sourceNode: { select: { title: true, isVisible: true } },
          targetNode: { select: { title: true, isVisible: true } },
        },
      });
      if (!dependency)
        throw new ApplicationError(
          404,
          'DEPENDENCY_NOT_FOUND',
          'La dependencia no existe en este roadmap.',
        );
      const before = await captureAccessSnapshot(transaction, roadmap.id);
      await transaction.dependency.delete({ where: { id: dependency.id } });
      const after = await captureAccessSnapshot(transaction, roadmap.id);
      if (dependency.sourceNode.isVisible && dependency.targetNode.isVisible)
        await captureRouteNoticeKnowledge(
          transaction,
          roadmap.id,
          after.participants
            .filter(({ userId }) => userId !== editor.userId)
            .map(({ userId }) => userId),
          dependencyTarget(dependency.sourceNodeId, dependency.targetNodeId),
          'true',
        );
      return {
        notifications: dependencyChangeNotifications({
          before,
          after,
          actorId: editor.userId,
          dependencyId: dependency.id,
          sourceNodeId: dependency.sourceNodeId,
          targetNodeId: dependency.targetNodeId,
          roadmapId: roadmap.id,
          changeKind: 'dependency-removed',
          sourceNode: dependency.sourceNode,
          targetNode: dependency.targetNode,
        }),
      };
    },
    () =>
      new ApplicationError(
        409,
        'DEPENDENCY_CONFLICT',
        'La dependencia entra en conflicto con otra modificación.',
      ),
  );
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
  { id, ...editor }: WithTeacherBlockOperation,
  authorizedRoadmap?: { id: string },
) {
  const roadmap = authorizedRoadmap ?? (await requireEditorRoadmap(transaction, editor));
  const nodeId = requireUuid(id, 'nodeId');
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId: roadmap.id },
      select: {
        id: true,
        title: true,
        isVisible: true,
        isTeacherBlocked: true,
        nodeType: { select: { name: true, icon: true, color: true } },
      },
      orderBy: { title: 'asc' },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId: roadmap.id } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const decision = decideTeacherBlock({
    nodes,
    dependencies,
    nodeId,
    operation: editor.operation,
  });
  if (decision.kind === 'ALLOWED') {
    const preview = { mode: decision.mode, nodes: decision.nodes };
    return {
      ...preview,
      version: createHash('sha256').update(JSON.stringify(preview)).digest('base64url'),
    } satisfies TeacherBlockPreview;
  }
  if (decision.reason === 'NODE_NOT_FOUND') {
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  }
  if (decision.reason === 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN') {
    throw new ApplicationError(
      409,
      'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
      'Un nodo oculto no puede tener un bloqueo docente.',
    );
  }
  throw new ApplicationError(
    409,
    'INVALID_TEACHER_BLOCK_OPERATION',
    'Operación de bloqueo no válida.',
  );
}

async function previewTeacherBlockUnsafe(input: WithTeacherBlockOperation) {
  return prisma.$transaction((transaction) => teacherBlockPreview(transaction, input), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

async function changeTeacherBlockUnsafe(input: WithTeacherBlockOperation) {
  return withSerializableTransaction(
    async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, input);
      const preview = await teacherBlockPreview(transaction, input, roadmap);
      if (
        input.operation !== 'BLOCK' &&
        (!input.previewVersion || input.previewVersion !== preview.version)
      ) {
        throw new ApplicationError(
          409,
          'TEACHER_BLOCK_PREVIEW_STALE',
          'El impacto del desbloqueo cambió. Revisa y confirma la previsualización actualizada.',
        );
      }
      const before = await captureAccessSnapshot(transaction, roadmap.id);
      if (preview.nodes.length > 0) {
        await transaction.roadmapNode.updateMany({
          where: { id: { in: preview.nodes.map((node) => node.id) } },
          data:
            input.operation === 'BLOCK'
              ? { isTeacherBlocked: true }
              : { isTeacherBlocked: false, teacherUnlockOn: null },
        });
      }
      // Unlocking a prerequisite can release dependents whose scheduled day already arrived.
      if (input.operation !== 'BLOCK') await releaseDueScheduledUnlocks(transaction, roadmap.id);
      const after = await captureAccessSnapshot(transaction, roadmap.id);
      return {
        ...preview,
        notifications: accessTransitionNotifications({
          before,
          after,
          actorId: input.userId,
          roadmapId: roadmap.id,
        }),
      };
    },
    () =>
      new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con otra modificación.',
      ),
  );
}

function calendarDayOf(date: Date): CalendarDay {
  return date.toISOString().slice(0, 10);
}

function calendarDayDate(day: CalendarDay) {
  return new Date(`${day}T00:00:00.000Z`);
}

async function dueScheduledUnlocks(
  client: Prisma.TransactionClient,
  roadmapId: string,
  today: CalendarDay,
) {
  const [nodes, dependencies] = await Promise.all([
    client.roadmapNode.findMany({
      where: { roadmapId },
      select: { id: true, isVisible: true, isTeacherBlocked: true, teacherUnlockOn: true },
    }),
    client.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  return dueScheduledUnlockNodeIds({
    nodes: nodes.map((node) => ({
      ...node,
      teacherUnlockOn: node.teacherUnlockOn ? calendarDayOf(node.teacherUnlockOn) : null,
    })),
    dependencies,
    today,
  });
}

async function releaseDueScheduledUnlocks(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  today = chileCalendarDay(),
) {
  const releasedNodeIds = await dueScheduledUnlocks(transaction, roadmapId, today);
  if (releasedNodeIds.size > 0) {
    await transaction.roadmapNode.updateMany({
      where: { id: { in: [...releasedNodeIds] } },
      data: { isTeacherBlocked: false, teacherUnlockOn: null },
    });
  }
  return releasedNodeIds;
}

async function scheduleTeacherUnlockUnsafe({ id, unlockOn, ...editor }: WithTeacherUnlockSchedule) {
  return withSerializableTransaction(
    async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      let day: CalendarDay | null = null;
      if (unlockOn !== null) {
        try {
          day = requireScheduledUnlockDay(unlockOn, chileCalendarDay());
        } catch (error) {
          if (!(error instanceof InvalidScheduledUnlockDay)) throw error;
          throw new ApplicationError(400, 'INVALID_TEACHER_UNLOCK_DATE', error.message);
        }
        if (!node.isVisible || !node.isTeacherBlocked) {
          throw new ApplicationError(
            409,
            'TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK',
            'Solo se puede programar el desbloqueo de un nodo visible con bloqueo docente.',
          );
        }
      }
      await transaction.roadmapNode.update({
        where: { id: node.id },
        data: { teacherUnlockOn: day ? calendarDayDate(day) : null },
      });
      return { teacherUnlockOn: day };
    },
    () =>
      new ApplicationError(
        409,
        'CONFLICT',
        'La operación entra en conflicto con otra modificación.',
      ),
  );
}

/** Releases every due scheduled unlock; run by the daily scheduled job. */
async function releaseScheduledTeacherUnlocksUnsafe(today = chileCalendarDay()) {
  const roadmaps = await prisma.roadmap.findMany({
    where: {
      closedAt: null,
      roadmapNodes: {
        some: { isTeacherBlocked: true, teacherUnlockOn: { lte: calendarDayDate(today) } },
      },
    },
    select: {
      id: true,
      courseOffering: { select: { courseCode: true, year: true, semester: true } },
    },
  });
  const released = [];
  for (const roadmap of roadmaps) {
    // A node waiting for blocked prerequisites stays due on every pass; checking outside a
    // transaction keeps those passes from contending with teaching edits on its Roadmap.
    if ((await dueScheduledUnlocks(prisma, roadmap.id, today)).size === 0) continue;
    const result = await withSerializableTransaction(
      async (transaction) => {
        await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmap.id}::uuid FOR UPDATE`;
        const current = await transaction.roadmap.findUnique({ where: { id: roadmap.id } });
        if (!current || current.closedAt) return { releasedNodeIds: [], notifications: [] };
        const before = await captureAccessSnapshot(transaction, roadmap.id);
        const releasedNodeIds = await releaseDueScheduledUnlocks(transaction, roadmap.id, today);
        const after = await captureAccessSnapshot(transaction, roadmap.id);
        return {
          releasedNodeIds: [...releasedNodeIds],
          notifications: accessTransitionNotifications({
            before,
            after,
            actorId: SCHEDULED_UNLOCK_ACTOR_ID,
            roadmapId: roadmap.id,
          }),
        };
      },
      () =>
        new ApplicationError(
          409,
          'CONFLICT',
          'El desbloqueo programado entra en conflicto con otra modificación.',
        ),
    );
    released.push({ identifier: roadmap.courseOffering, ...result });
  }
  return released;
}

export function createRoadmapNode(input: WithInput) {
  return applicationResult(() => createRoadmapNodeUnsafe(input));
}

export function updateRoadmapNode(input: WithId & { input: JsonObject }) {
  return applicationResult(() => updateRoadmapNodeUnsafe(input));
}

export function previewNodeVisibility(input: WithId) {
  return applicationResult(() => previewNodeVisibilityUnsafe(input));
}

export function previewNodeDeletion(input: WithId) {
  return applicationResult(() => previewNodeDeletionUnsafe(input));
}

export function deleteRoadmapNode(input: WithDeletePreview) {
  return applicationResult(() => deleteRoadmapNodeUnsafe(input));
}

export function createRoadmapNodeType(input: WithInput) {
  return applicationResult(() => createRoadmapNodeTypeUnsafe(input));
}

export function updateRoadmapNodeType(input: WithId & { input: JsonObject }) {
  return applicationResult(() => updateRoadmapNodeTypeUnsafe(input));
}

export function deleteRoadmapNodeType(input: WithId) {
  return applicationResult(() => deleteRoadmapNodeTypeUnsafe(input));
}

export function createRoadmapDependency(input: WithInput) {
  return applicationResult(() => createRoadmapDependencyUnsafe(input));
}

export function previewRoadmapDependency(input: WithInput) {
  return applicationResult(() => previewRoadmapDependencyUnsafe(input));
}

export function deleteRoadmapDependency(input: WithId) {
  return applicationResult(() => deleteRoadmapDependencyUnsafe(input));
}

export function previewTeacherBlock(input: WithTeacherBlockOperation) {
  return applicationResult(() => previewTeacherBlockUnsafe(input));
}

export function changeTeacherBlock(input: WithTeacherBlockOperation) {
  return applicationResult(() => changeTeacherBlockUnsafe(input));
}

export function scheduleTeacherUnlock(input: WithTeacherUnlockSchedule) {
  return applicationResult(() => scheduleTeacherUnlockUnsafe(input));
}

export function releaseScheduledTeacherUnlocks(today?: CalendarDay) {
  return applicationResult(() => releaseScheduledTeacherUnlocksUnsafe(today));
}
