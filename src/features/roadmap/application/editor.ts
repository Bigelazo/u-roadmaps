import type { RoadmapChangePort, RoadmapChangeFact } from './change-port';
import { roadmapChangeTransaction, type RoadmapChangeReporter } from './change-transaction';
import { serializableTransaction } from './serializable';
import { accessChanges } from './access-changes';
import { readAccessSnapshot } from './access-snapshot';
import 'server-only';

import { createHash } from 'node:crypto';
import { Prisma, prisma } from '@/shared/server/db';
import { nodeDto, nodeTypeDto, resourceDto } from '@/features/roadmap/application/roadmap';
import {
  nodeDescription,
  optionalString,
  requireBoolean,
  requireNodeTypeColor,
  requireNodeTypeIcon,
  requireFiniteNumber,
  requireString,
} from '@/features/roadmap/application/validation';
import { normalizeName } from '@/features/roadmap/domain/roadmap-copy';
import { requireUuid } from '@/shared/validation';
import { ApplicationError, withApplicationResult } from '@/shared/errors/server';
import type {
  NodeDeletionImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import { decideTeacherBlock } from '@/features/roadmap/domain/teacher-block';
import {
  transitiveDependentNodeIds,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
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

const dependencyConflict = () =>
  new ApplicationError(
    409,
    'DEPENDENCY_CONFLICT',
    'La dependencia entra en conflicto con otra modificación.',
  );

/** Prisma filter for the dependencies that start or end at `nodeId`. */
function touchingNode(nodeId: string) {
  return { OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }] };
}

function versionHash(value: unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('base64url');
}

function repeatableRead<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>) {
  return prisma.$transaction(operation, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

function reportEditorChange(
  report: RoadmapChangeReporter,
  editor: EditorInput,
  roadmapId: string,
  facts: RoadmapChangeFact[],
) {
  return report({ actorId: editor.userId, identifier: editor.identifier, roadmapId, facts });
}

/** Runs `change` between two access snapshots and returns the access facts it caused. */
async function trackAccessChanges<T>(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  change: () => Promise<T>,
) {
  const before = await readAccessSnapshot(transaction, roadmapId);
  const result = await change();
  const after = await readAccessSnapshot(transaction, roadmapId);
  return { result, accessFacts: accessChanges(before, after) };
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
  operation: (transaction: Prisma.TransactionClient, report: RoadmapChangeReporter) => Promise<T>,
  changePort?: RoadmapChangePort,
  concurrentModification?: () => ApplicationError,
) {
  return changePort
    ? roadmapChangeTransaction(changePort, operation, { serializable: { concurrentModification } })
    : serializableTransaction((transaction) => operation(transaction, async () => undefined), {
        concurrentModification,
      });
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

export const createRoadmapNode = withApplicationResult(
  async ({ input, ...editor }: WithInput, changePort: RoadmapChangePort) =>
    roadmapChangeTransaction(changePort, async (transaction, report) => {
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
      await reportEditorChange(report, editor, roadmap.id, [
        { kind: 'node-created', nodeId: node.id, previous: null, current: node },
      ]);
      return nodeDto(node);
    }),
);

export const updateRoadmapNode = withApplicationResult(
  async ({ id, input, ...editor }: WithId & { input: JsonObject }, changePort: RoadmapChangePort) =>
    withSerializableTransaction(async (transaction, report) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const node = await requireNode(transaction, requireUuid(id, 'nodeId'), roadmap.id);
      const requestedVisibility =
        'isVisible' in input ? requireBoolean(input.isVisible, 'isVisible') : undefined;
      const beforeVisibility =
        requestedVisibility === undefined
          ? null
          : await readAccessSnapshot(transaction, roadmap.id);
      const data: Prisma.RoadmapNodeUncheckedUpdateInput = {};
      if ('title' in input) data.title = requireString(input.title, 'title', 240);
      if ('description' in input) data.description = nodeDescription(input.description) ?? null;
      const nodeTypeId =
        'nodeTypeId' in input ? requireUuid(input.nodeTypeId, 'nodeTypeId') : undefined;
      if (nodeTypeId !== undefined) {
        data.nodeTypeId = nodeTypeId;
        await requireType(transaction, nodeTypeId, roadmap.id);
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
            where: touchingNode(node.id),
            select: { id: true, sourceNodeId: true, targetNodeId: true },
            orderBy: { id: 'asc' },
          })
        : [];
      if (hiddenAfterUpdate) {
        data.isTeacherBlocked = false;
        data.teacherUnlockOn = null;
      }
      if (removedDependencies.length > 0) {
        await transaction.dependency.deleteMany({ where: touchingNode(node.id) });
      }
      const updated = await transaction.roadmapNode.update({
        where: { id: node.id },
        data,
        include: { resources: { orderBy: { title: 'asc' } } },
      });
      const [previousType, currentType] =
        nodeTypeId && nodeTypeId !== node.nodeTypeId
          ? await Promise.all([
              requireType(transaction, node.nodeTypeId, roadmap.id),
              requireType(transaction, nodeTypeId, roadmap.id),
            ])
          : [null, null];
      const facts: RoadmapChangeFact[] = [];
      if (data.title !== undefined && data.title !== node.title)
        facts.push({
          kind: 'node-title',
          nodeId: node.id,
          previous: node.title,
          current: updated.title,
        });
      if (data.description !== undefined && data.description !== node.description)
        facts.push({
          kind: 'node-description',
          nodeId: node.id,
          previous: node.description,
          current: updated.description,
        });
      if (previousType && currentType)
        facts.push({
          kind: 'node-type',
          nodeId: node.id,
          previous: { id: previousType.id, name: previousType.name },
          current: { id: currentType.id, name: currentType.name },
        });
      if (beforeVisibility && requestedVisibility !== node.isVisible) {
        facts.push({
          kind: 'node-visibility',
          nodeId: node.id,
          previous: node.isVisible,
          current: updated.isVisible,
        });
        facts.push(
          ...accessChanges(beforeVisibility, await readAccessSnapshot(transaction, roadmap.id)),
        );
      }
      if (facts.length) await reportEditorChange(report, editor, roadmap.id, facts);
      return {
        node: {
          ...nodeDto(updated),
          resources: updated.resources.map((resource) => resourceDto(resource, editor.identifier)),
        },
        ...(requestedVisibility !== undefined ? { dependencies: removedDependencies } : {}),
      };
    }, changePort),
);

async function nodeDeletionPreview(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  id: string,
): Promise<NodeDeletionImpact> {
  const node = await transaction.roadmapNode.findFirst({
    where: { id: requireUuid(id, 'nodeId'), roadmapId },
    include: {
      nodeType: { select: { name: true, icon: true, color: true } },
      resources: { select: { id: true, title: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!node)
    throw new ApplicationError(404, 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  const dependencies = await transaction.dependency.findMany({
    where: touchingNode(node.id),
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
  return { ...impact, version: versionHash(impact) };
}

export const previewNodeDeletion = withApplicationResult(async ({ id, ...editor }: WithId) =>
  repeatableRead(async (transaction) =>
    nodeDeletionPreview(transaction, (await requireEditorRoadmap(transaction, editor)).id, id),
  ),
);

export const deleteRoadmapNode = withApplicationResult(
  async ({ id, previewVersion, ...editor }: WithDeletePreview, changePort: RoadmapChangePort) => {
    const deletion = await withSerializableTransaction(
      async (transaction, report) => {
        const roadmap = await requireEditorRoadmap(transaction, editor);
        const preview = await nodeDeletionPreview(transaction, roadmap.id, id);
        if (previewVersion && previewVersion !== preview.version) {
          throw new ApplicationError(
            409,
            'NODE_DELETE_PREVIEW_STALE',
            'El impacto de la eliminación cambió. Revisa y confirma la previsualización actualizada.',
          );
        }
        const resources = await transaction.resource.findMany({
          where: { roadmapNodeId: id, fileKey: { not: null } },
          select: { fileKey: true },
        });
        const {
          result: { node, nodeType },
          accessFacts,
        } = await trackAccessChanges(transaction, roadmap.id, async () => {
          const node = await requireNode(transaction, id, roadmap.id);
          const nodeType = await requireType(transaction, node.nodeTypeId, roadmap.id);
          await transaction.roadmapNode.delete({ where: { id } });
          return { node, nodeType };
        });
        await reportEditorChange(report, editor, roadmap.id, [
          {
            kind: 'node-deleted',
            nodeId: id,
            nodeTypeName: nodeType.name,
            previous: node,
            current: null,
          },
          ...accessFacts,
        ]);
        return { fileKeys: resources.flatMap(({ fileKey }) => (fileKey ? [fileKey] : [])) };
      },
      changePort,
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
    return {};
  },
);

export const createRoadmapNodeType = withApplicationResult(
  async ({ input, ...editor }: WithInput) =>
    prisma.$transaction(async (transaction) => {
      const roadmap = await requireEditorRoadmap(transaction, editor);
      const name = requireString(input.name, 'name', 120);
      const icon = requireNodeTypeIcon(input.icon);
      const color = requireNodeTypeColor(input.color);
      await ensureTypeNameAvailable(transaction, name, roadmap.id);
      return nodeTypeDto(
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
    }),
);

export const updateRoadmapNodeType = withApplicationResult(
  async ({ id, input, ...editor }: WithId & { input: JsonObject }, changePort: RoadmapChangePort) =>
    roadmapChangeTransaction(changePort, async (transaction, report) => {
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
      if (data.name !== undefined && data.name !== nodeType.name)
        await reportEditorChange(report, editor, roadmap.id, [
          {
            kind: 'node-type-name',
            nodeTypeId: nodeType.id,
            previous: nodeType.name,
            current: updated.name,
          },
        ]);
      return {
        nodeType: nodeTypeDto(updated),
      };
    }),
);

export const deleteRoadmapNodeType = withApplicationResult(async ({ id, ...editor }: WithId) =>
  prisma.$transaction(async (transaction) => {
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
  }),
);

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
  if (wouldCreateDependencyCycle(dependencies, sourceNodeId, targetNodeId))
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

export const createRoadmapDependency = withApplicationResult(
  async ({ input, ...editor }: WithInput, changePort: RoadmapChangePort) =>
    withSerializableTransaction(
      async (transaction, report) => {
        const prepared = await prepareRoadmapDependency(transaction, { input, ...editor });
        const nodes = await teacherBlockedDependentNodes(transaction, {
          ...prepared,
          dependencies: [
            ...prepared.dependencies,
            { sourceNodeId: prepared.sourceNodeId, targetNodeId: prepared.targetNodeId },
          ],
        });
        const { result: dependency, accessFacts } = await trackAccessChanges(
          transaction,
          prepared.roadmapId,
          async () => {
            const dependency = await transaction.dependency.create({
              data: {
                sourceNodeId: prepared.sourceNodeId,
                targetNodeId: prepared.targetNodeId,
                sourceHandle: prepared.sourceHandle,
                targetHandle: prepared.targetHandle,
              },
            });
            if (nodes.length > 0) {
              await transaction.roadmapNode.updateMany({
                where: { id: { in: nodes.map((node) => node.id) } },
                data: { isTeacherBlocked: true },
              });
            }
            return dependency;
          },
        );
        await reportEditorChange(report, editor, prepared.roadmapId, [
          {
            kind: 'dependency' as const,
            dependencyId: dependency.id,
            sourceNodeId: prepared.sourceNodeId,
            targetNodeId: prepared.targetNodeId,
            previous: false,
            current: true,
            sourceNode: prepared.sourceNode,
            targetNode: prepared.targetNode,
          },
          ...accessFacts,
        ]);
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
      changePort,
      dependencyConflict,
    ),
);

export const previewRoadmapDependency = withApplicationResult(
  async ({ input, ...editor }: WithInput) =>
    repeatableRead(async (transaction) => {
      const prepared = await prepareRoadmapDependency(transaction, { input, ...editor });
      return {
        nodes: await teacherBlockedDependentNodes(transaction, prepared),
      };
    }),
);

export const deleteRoadmapDependency = withApplicationResult(
  async ({ id, ...editor }: WithId, changePort: RoadmapChangePort) =>
    withSerializableTransaction(
      async (transaction, report) => {
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
        const { accessFacts } = await trackAccessChanges(transaction, roadmap.id, () =>
          transaction.dependency.delete({ where: { id: dependency.id } }),
        );
        await reportEditorChange(report, editor, roadmap.id, [
          {
            kind: 'dependency' as const,
            dependencyId: dependency.id,
            sourceNodeId: dependency.sourceNodeId,
            targetNodeId: dependency.targetNodeId,
            previous: true,
            current: false,
            sourceNode: dependency.sourceNode,
            targetNode: dependency.targetNode,
          },
          ...accessFacts,
        ]);
        return {};
      },
      changePort,
      dependencyConflict,
    ),
);

export const previewNodeVisibility = withApplicationResult(async (input: WithId) =>
  repeatableRead(async (transaction) => {
    const roadmap = await requireEditorRoadmap(transaction, input);
    const node = await requireNode(transaction, requireUuid(input.id, 'nodeId'), roadmap.id);
    const dependencies = await transaction.dependency.findMany({
      where: touchingNode(node.id),
      select: { id: true, sourceNodeId: true, targetNodeId: true },
      orderBy: { id: 'asc' },
    });
    return { dependencies };
  }),
);

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
    return { ...preview, version: versionHash(preview) } satisfies TeacherBlockPreview;
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

export const previewTeacherBlock = withApplicationResult(async (input: WithTeacherBlockOperation) =>
  repeatableRead((transaction) => teacherBlockPreview(transaction, input)),
);

export const changeTeacherBlock = withApplicationResult(
  async (input: WithTeacherBlockOperation, changePort: RoadmapChangePort) =>
    withSerializableTransaction(async (transaction, report) => {
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
      const { accessFacts } = await trackAccessChanges(transaction, roadmap.id, async () => {
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
      });
      await reportEditorChange(report, input, roadmap.id, accessFacts);
      return preview;
    }, changePort),
);

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

export const scheduleTeacherUnlock = withApplicationResult(
  async ({ id, unlockOn, ...editor }: WithTeacherUnlockSchedule) =>
    withSerializableTransaction(async (transaction) => {
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
    }),
);

/** Releases every due scheduled unlock; run by the daily scheduled job. */
export const releaseScheduledTeacherUnlocks = withApplicationResult(
  async (changePort: RoadmapChangePort, today: CalendarDay = chileCalendarDay()) => {
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
        async (transaction, report) => {
          await transaction.$queryRaw`SELECT id FROM "Roadmap" WHERE id = ${roadmap.id}::uuid FOR UPDATE`;
          const current = await transaction.roadmap.findUnique({ where: { id: roadmap.id } });
          if (!current || current.closedAt) return { releasedNodeIds: [] };
          const { result: releasedNodeIds, accessFacts } = await trackAccessChanges(
            transaction,
            roadmap.id,
            () => releaseDueScheduledUnlocks(transaction, roadmap.id, today),
          );
          await report({
            actorId: SCHEDULED_UNLOCK_ACTOR_ID,
            identifier: roadmap.courseOffering,
            roadmapId: roadmap.id,
            facts: accessFacts,
          });
          return { releasedNodeIds: [...releasedNodeIds] };
        },
        changePort,
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
  },
);
