import 'server-only';

import { createHash } from 'node:crypto';
import { prisma, type Prisma } from '@/shared/server/db';
import type { RoadmapChangeFact, RoadmapChangePort } from './change-port';
import {
  changeRoadmap,
  roadmapChangeTransaction,
  roadmapCommand,
  roadmapRead,
  type RoadmapParticipant,
} from './roadmap-command';
import { nodeNotFound } from './errors';
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
import { ApplicationError } from '@/shared/errors/server';
import type { ApplicationErrorStatus } from '@/shared/errors/types';
import type {
  NodeDeletionImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import {
  decideTeacherBlock,
  type TeacherBlockRuleFailure,
} from '@/features/roadmap/domain/teacher-block';
import { decideDependency, type DependencyRuleFailure } from '@/features/roadmap/domain/dependency';
import type { RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import { decideVisibilityChange } from '@/features/roadmap/domain/node-visibility';
import {
  chileCalendarDay,
  decideScheduledUnlock,
  decideScheduledUnlockDay,
  dueScheduledUnlockNodeIds,
  type CalendarDay,
  type ScheduledUnlockRuleFailure,
} from '@/features/roadmap/domain/scheduled-unlock';
import { deleteUploadedFile } from '@/features/roadmap/infrastructure/resources/filesystem';

type JsonObject = Record<string, unknown>;

/** Nil UUID: no participant matches it, so every affected participant is notified. */
export const SCHEDULED_UNLOCK_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

/** Prisma filter for the dependencies that start or end at `nodeId`. */
function touchingNode(nodeId: string) {
  return { OR: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }] };
}

/** The Dependencies hiding `nodeId` removes, in the order its visibility preview hashes. */
function dependenciesTouching(transaction: Prisma.TransactionClient, nodeId: string) {
  return transaction.dependency.findMany({
    where: touchingNode(nodeId),
    select: { id: true, sourceNodeId: true, targetNodeId: true },
    orderBy: { id: 'asc' },
  });
}

type RoadmapRuleFailure =
  DependencyRuleFailure | TeacherBlockRuleFailure | ScheduledUnlockRuleFailure;

const RULE_FAILURE_STATUS: Readonly<Record<RoadmapRuleFailure, ApplicationErrorStatus>> = {
  NODE_NOT_FOUND: 404,
  SELF_DEPENDENCY: 409,
  HIDDEN_NODE_DEPENDENCY_FORBIDDEN: 403,
  DEPENDENCY_CONFLICT: 409,
  DEPENDENCY_CYCLE: 409,
  HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN: 409,
  INVALID_TEACHER_UNLOCK_DATE: 400,
  TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK: 409,
};

function ruleError({ reason, message }: RuleRejection<RoadmapRuleFailure>) {
  return new ApplicationError(RULE_FAILURE_STATUS[reason], reason, message);
}

/** A preview's impact with its `version`, the hash a confirmation sends back. */
function versioned<Impact extends object>(impact: Impact) {
  const version = createHash('sha256').update(JSON.stringify(impact)).digest('base64url');
  return { ...impact, version };
}

/**
 * Rejects a confirmation whose sent preview version no longer matches the current impact.
 * A missing version passes unless it is `required`. `impact` names what the preview showed.
 */
function rejectStalePreview(
  sentVersion: string | undefined,
  { version }: { version: string },
  code: string,
  impact: string,
  { required = false } = {},
) {
  if (sentVersion ? sentVersion !== version : required) {
    throw new ApplicationError(
      409,
      code,
      `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
    );
  }
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

export async function requireNode(
  transaction: Prisma.TransactionClient,
  id: string,
  roadmapId: string,
) {
  const node = await transaction.roadmapNode.findFirst({ where: { id, roadmapId } });
  if (!node) throw nodeNotFound();
  return node;
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

function noChanges(message: string): never {
  throw new ApplicationError(400, 'INVALID_REQUEST', message);
}

export const createRoadmapNode = roadmapCommand({
  capability: 'edit',
  parse: ({ input }: { input: JsonObject }) => ({
    title: requireString(input.title, 'title', 240),
    description: nodeDescription(input.description),
    nodeTypeId: requireUuid(input.nodeTypeId, 'nodeTypeId'),
    positionX: requireFiniteNumber(input.positionX, 'positionX'),
    positionY: requireFiniteNumber(input.positionY, 'positionY'),
    isVisible: input.isVisible === undefined ? true : requireBoolean(input.isVisible, 'isVisible'),
  }),
  access: 'none',
  run: async ({ tx, roadmap, input }) => {
    await requireType(tx, input.nodeTypeId, roadmap.id);
    const node = await tx.roadmapNode.create({ data: { roadmapId: roadmap.id, ...input } });
    return {
      result: nodeDto(node),
      facts: [{ kind: 'node-created', nodeId: node.id, previous: null, current: node }],
    };
  },
});

type NodeChanges = {
  isVisible?: boolean;
  title?: string;
  description?: string | null;
  nodeTypeId?: string;
  positionX?: number;
  positionY?: number;
};

/** A Node edit; only a visibility change can change anyone's Node access. */
export const updateRoadmapNode = roadmapCommand({
  capability: 'edit',
  parse: ({
    id,
    input,
    previewVersion,
  }: {
    id: string;
    input: JsonObject;
    /** The visibility preview's version; checked only when the edit hides the Node. */
    previewVersion?: string;
  }) => {
    const nodeId = requireUuid(id, 'nodeId');
    const changes: NodeChanges = {};
    if ('isVisible' in input) changes.isVisible = requireBoolean(input.isVisible, 'isVisible');
    if ('title' in input) changes.title = requireString(input.title, 'title', 240);
    if ('description' in input) changes.description = nodeDescription(input.description) ?? null;
    if ('nodeTypeId' in input) changes.nodeTypeId = requireUuid(input.nodeTypeId, 'nodeTypeId');
    if ('positionX' in input) changes.positionX = requireFiniteNumber(input.positionX, 'positionX');
    if ('positionY' in input) changes.positionY = requireFiniteNumber(input.positionY, 'positionY');
    if (Object.keys(changes).length === 0)
      noChanges('Debe indicar al menos un campo para actualizar.');
    return { nodeId, changes, previewVersion };
  },
  access: ({ changes }) => (changes.isVisible === undefined ? 'none' : 'roadmap'),
  run: async ({ tx, roadmap, actor, input: { nodeId, changes, previewVersion } }) => {
    const node = await requireNode(tx, nodeId, roadmap.id);
    if (changes.nodeTypeId !== undefined) await requireType(tx, changes.nodeTypeId, roadmap.id);
    const isVisible = changes.isVisible ?? node.isVisible;
    // Only a hidden Node loses Dependencies; skip the read on ordinary edits and moves.
    const dependencies = isVisible ? [] : await dependenciesTouching(tx, node.id);
    if (changes.isVisible === false) {
      rejectStalePreview(
        previewVersion,
        versioned({ dependencies }),
        'NODE_VISIBILITY_PREVIEW_STALE',
        'de ocultar el nodo',
      );
    }
    const { removedDependencies, clearsTeacherBlock } = decideVisibilityChange({
      nodeId: node.id,
      isVisible,
      dependencies,
    });
    if (removedDependencies.length > 0) {
      await tx.dependency.deleteMany({ where: touchingNode(node.id) });
    }
    const updated = await tx.roadmapNode.update({
      where: { id: node.id },
      data: clearsTeacherBlock
        ? { ...changes, isTeacherBlocked: false, teacherUnlockOn: null }
        : changes,
      include: { resources: { orderBy: { title: 'asc' } } },
    });
    const [previousType, currentType] =
      changes.nodeTypeId && changes.nodeTypeId !== node.nodeTypeId
        ? await Promise.all([
            requireType(tx, node.nodeTypeId, roadmap.id),
            requireType(tx, changes.nodeTypeId, roadmap.id),
          ])
        : [null, null];
    const facts: RoadmapChangeFact[] = [];
    if (changes.title !== undefined && changes.title !== node.title)
      facts.push({
        kind: 'node-title',
        nodeId: node.id,
        previous: node.title,
        current: updated.title,
      });
    if (changes.description !== undefined && changes.description !== node.description)
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
    if (changes.isVisible !== undefined && changes.isVisible !== node.isVisible)
      facts.push({
        kind: 'node-visibility',
        nodeId: node.id,
        previous: node.isVisible,
        current: updated.isVisible,
      });
    return {
      result: {
        node: {
          ...nodeDto(updated),
          resources: updated.resources.map((resource) => resourceDto(resource, actor.identifier)),
        },
        ...(changes.isVisible !== undefined ? { dependencies: removedDependencies } : {}),
      },
      facts,
    };
  },
});

async function nodeDeletionPreview(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  nodeId: string,
): Promise<NodeDeletionImpact> {
  const node = await transaction.roadmapNode.findFirst({
    where: { id: nodeId, roadmapId },
    include: {
      nodeType: { select: { name: true, icon: true, color: true } },
      resources: { select: { id: true, title: true }, orderBy: [{ title: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!node) throw nodeNotFound();
  const dependencies = await transaction.dependency.findMany({
    where: touchingNode(node.id),
    select: {
      id: true,
      sourceNode: { select: { title: true } },
      targetNode: { select: { title: true } },
    },
    orderBy: { id: 'asc' },
  });
  return versioned({
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
  });
}

export const previewNodeDeletion = async ({
  id,
  ...participant
}: RoadmapParticipant & { id: string }) => {
  const nodeId = requireUuid(id, 'nodeId');
  return roadmapRead(participant, 'edit', ({ tx, roadmap }) =>
    nodeDeletionPreview(tx, roadmap.id, nodeId),
  );
};

/** Deletes the Node and returns the keys of its stored files. */
const nodeDeletion = roadmapCommand({
  capability: 'edit',
  parse: ({ id, previewVersion }: { id: string; previewVersion?: string }) => ({
    nodeId: requireUuid(id, 'nodeId'),
    previewVersion,
  }),
  access: 'roadmap',
  conflictMessage: 'La eliminación entra en conflicto con otra modificación.',
  run: async ({ tx, roadmap, input: { nodeId, previewVersion } }) => {
    rejectStalePreview(
      previewVersion,
      await nodeDeletionPreview(tx, roadmap.id, nodeId),
      'NODE_DELETE_PREVIEW_STALE',
      'de la eliminación',
    );
    const resources = await tx.resource.findMany({
      where: { roadmapNodeId: nodeId, fileKey: { not: null } },
      select: { fileKey: true },
    });
    const node = await requireNode(tx, nodeId, roadmap.id);
    const nodeType = await requireType(tx, node.nodeTypeId, roadmap.id);
    await tx.roadmapNode.delete({ where: { id: nodeId } });
    return {
      result: resources.flatMap(({ fileKey }) => (fileKey ? [fileKey] : [])),
      facts: [
        {
          kind: 'node-deleted',
          nodeId,
          nodeTypeName: nodeType.name,
          previous: node,
          current: null,
        },
      ],
    };
  },
});

/** Deletes the Node, then its stored files once the deletion committed. */
export const deleteRoadmapNode = async (
  request: Parameters<typeof nodeDeletion>[0],
  changePort: RoadmapChangePort,
) => {
  const fileKeys = await nodeDeletion(request, changePort);
  await Promise.all(fileKeys.map((fileKey) => deleteUploadedFile(fileKey).catch(() => undefined)));
  return {};
};

export const createRoadmapNodeType = roadmapCommand({
  capability: 'edit',
  parse: ({ input }: { input: JsonObject }) => ({
    name: requireString(input.name, 'name', 120),
    icon: requireNodeTypeIcon(input.icon),
    color: requireNodeTypeColor(input.color),
  }),
  access: 'none',
  run: async ({ tx, roadmap, input: { name, icon, color } }) => {
    await ensureTypeNameAvailable(tx, name, roadmap.id);
    const nodeType = await tx.nodeType.create({
      data: {
        roadmapId: roadmap.id,
        name,
        normalizedName: normalizeName(name),
        icon,
        color,
        isPredefined: false,
      },
    });
    return { result: nodeTypeDto(nodeType), facts: [] };
  },
});

export const updateRoadmapNodeType = roadmapCommand({
  capability: 'edit',
  parse: ({ id, input }: { id: string; input: JsonObject }) => {
    const typeId = requireUuid(id, 'typeId');
    const changes: { name?: string; icon?: string; color?: string } = {};
    if ('name' in input) changes.name = requireString(input.name, 'name', 120);
    if ('icon' in input) changes.icon = requireNodeTypeIcon(input.icon);
    if ('color' in input) changes.color = requireNodeTypeColor(input.color);
    if (Object.keys(changes).length === 0)
      noChanges('Debe indicar nombre, ícono o color para actualizar.');
    return { typeId, changes };
  },
  access: 'none',
  run: async ({ tx, roadmap, input: { typeId, changes } }) => {
    const nodeType = await requireCustomType(tx, typeId, roadmap.id);
    const { name } = changes;
    if (name !== undefined) await ensureTypeNameAvailable(tx, name, roadmap.id, nodeType.id);
    const updated = await tx.nodeType.update({
      where: { id: nodeType.id },
      data: name === undefined ? changes : { ...changes, normalizedName: normalizeName(name) },
    });
    return {
      result: { nodeType: nodeTypeDto(updated) },
      facts:
        name !== undefined && name !== nodeType.name
          ? [
              {
                kind: 'node-type-name',
                nodeTypeId: nodeType.id,
                previous: nodeType.name,
                current: updated.name,
              },
            ]
          : [],
    };
  },
});

export const deleteRoadmapNodeType = roadmapCommand({
  capability: 'edit',
  parse: ({ id }: { id: string }) => requireUuid(id, 'typeId'),
  access: 'none',
  run: async ({ tx, roadmap, input: typeId }) => {
    const nodeType = await requireCustomType(tx, typeId, roadmap.id);
    if (await tx.roadmapNode.count({ where: { nodeTypeId: nodeType.id } })) {
      throw new ApplicationError(
        409,
        'NODE_TYPE_IN_USE',
        'No se puede eliminar un tipo utilizado por nodos.',
      );
    }
    await tx.nodeType.delete({ where: { id: nodeType.id } });
    return { result: undefined, facts: [] };
  },
});

function parseDependency({ input }: { input: JsonObject }) {
  return {
    sourceNodeId: requireUuid(input.sourceNodeId, 'sourceNodeId'),
    targetNodeId: requireUuid(input.targetNodeId, 'targetNodeId'),
    sourceHandle: dependencyHandle(input.sourceHandle, 'sourceHandle', 'right'),
    targetHandle: dependencyHandle(input.targetHandle, 'targetHandle', 'left'),
  };
}

/** Decides the Dependency on the Roadmap's graph: its endpoints and the Nodes it blocks. */
async function decideRoadmapDependency(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  { sourceNodeId, targetNodeId }: ReturnType<typeof parseDependency>,
) {
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: { id: true, title: true, isVisible: true, isTeacherBlocked: true },
      // Equal titles keep one order, so the preview's version is stable.
      orderBy: { id: 'asc' },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const decision = decideDependency({ nodes, dependencies, sourceNodeId, targetNodeId });
  if (decision.kind === 'REJECTED') throw ruleError(decision);
  // The decision guarantees both Nodes exist.
  const nodeFacts = (id: string) => {
    const { title, isVisible } = nodes.find((node) => node.id === id)!;
    return { title, isVisible };
  };
  return {
    sourceNode: nodeFacts(sourceNodeId),
    targetNode: nodeFacts(targetNodeId),
    /** The Dependency preview: the dependents its source's Teacher block would block. */
    preview: versioned({ nodes: decision.teacherBlockedNodes }),
  };
}

export const createRoadmapDependency = roadmapCommand({
  capability: 'edit',
  parse: ({ previewVersion, ...request }: { input: JsonObject; previewVersion?: string }) => ({
    dependency: parseDependency(request),
    previewVersion,
  }),
  access: 'roadmap',
  conflictMessage: 'La dependencia entra en conflicto con otra modificación.',
  run: async ({ tx, roadmap, input: { dependency: input, previewVersion } }) => {
    const { sourceNode, targetNode, preview } = await decideRoadmapDependency(
      tx,
      roadmap.id,
      input,
    );
    rejectStalePreview(previewVersion, preview, 'DEPENDENCY_PREVIEW_STALE', 'de la dependencia');
    const { nodes } = preview;
    const dependency = await tx.dependency.create({ data: input });
    if (nodes.length > 0) {
      await tx.roadmapNode.updateMany({
        where: { id: { in: nodes.map((node) => node.id) } },
        data: { isTeacherBlocked: true },
      });
    }
    return {
      result: { dependency: { id: dependency.id, ...input }, nodes },
      facts: [
        {
          kind: 'dependency',
          dependencyId: dependency.id,
          sourceNodeId: input.sourceNodeId,
          targetNodeId: input.targetNodeId,
          previous: false,
          current: true,
          sourceNode,
          targetNode,
        },
      ],
    };
  },
});

export const previewRoadmapDependency = async ({
  input,
  ...participant
}: RoadmapParticipant & { input: JsonObject }) => {
  const dependency = parseDependency({ input });
  return roadmapRead(
    participant,
    'edit',
    async ({ tx, roadmap }) => (await decideRoadmapDependency(tx, roadmap.id, dependency)).preview,
  );
};

export const deleteRoadmapDependency = roadmapCommand({
  capability: 'edit',
  parse: ({ id }: { id: string }) => requireUuid(id, 'dependencyId'),
  access: 'roadmap',
  conflictMessage: 'La dependencia entra en conflicto con otra modificación.',
  run: async ({ tx, roadmap, input: dependencyId }) => {
    const dependency = await tx.dependency.findFirst({
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
    await tx.dependency.delete({ where: { id: dependency.id } });
    return {
      result: {},
      facts: [
        {
          kind: 'dependency',
          dependencyId: dependency.id,
          sourceNodeId: dependency.sourceNodeId,
          targetNodeId: dependency.targetNodeId,
          previous: true,
          current: false,
          sourceNode: dependency.sourceNode,
          targetNode: dependency.targetNode,
        },
      ],
    };
  },
});

export const previewNodeVisibility = async ({
  id,
  ...participant
}: RoadmapParticipant & { id: string }) => {
  const nodeId = requireUuid(id, 'nodeId');
  return roadmapRead(participant, 'edit', async ({ tx, roadmap }) => {
    const node = await requireNode(tx, nodeId, roadmap.id);
    return versioned({ dependencies: await dependenciesTouching(tx, node.id) });
  });
};

type TeacherBlockRequest = { id: string; operation: TeacherBlockOperation };

function parseTeacherBlock({ id, operation }: TeacherBlockRequest) {
  return { nodeId: requireUuid(id, 'nodeId'), operation };
}

async function teacherBlockPreview(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  { nodeId, operation }: ReturnType<typeof parseTeacherBlock>,
) {
  const [nodes, dependencies] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: {
        id: true,
        title: true,
        isVisible: true,
        isTeacherBlocked: true,
        nodeType: { select: { name: true, icon: true, color: true } },
      },
      // Equal titles keep one order, so the preview's version is stable.
      orderBy: [{ title: 'asc' }, { id: 'asc' }],
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { sourceNodeId: true, targetNodeId: true },
    }),
  ]);
  const decision = decideTeacherBlock({ nodes, dependencies, nodeId, operation });
  if (decision.kind === 'REJECTED') throw ruleError(decision);
  return versioned({
    mode: decision.mode,
    nodes: decision.nodes,
  }) satisfies TeacherBlockPreview;
}

export const previewTeacherBlock = async ({
  id,
  operation,
  ...participant
}: RoadmapParticipant & TeacherBlockRequest) => {
  const request = parseTeacherBlock({ id, operation });
  return roadmapRead(participant, 'edit', ({ tx, roadmap }) =>
    teacherBlockPreview(tx, roadmap.id, request),
  );
};

export const changeTeacherBlock = roadmapCommand({
  capability: 'edit',
  parse: ({ previewVersion, ...request }: TeacherBlockRequest & { previewVersion?: string }) => ({
    ...parseTeacherBlock(request),
    previewVersion,
  }),
  access: 'roadmap',
  run: async ({ tx, roadmap, input }) => {
    const preview = await teacherBlockPreview(tx, roadmap.id, input);
    const blocks = input.operation === 'BLOCK';
    rejectStalePreview(
      input.previewVersion,
      preview,
      'TEACHER_BLOCK_PREVIEW_STALE',
      blocks ? 'del bloqueo' : 'del desbloqueo',
      // An unlock must confirm its previewed impact; a BLOCK only when it sends a version.
      { required: !blocks },
    );
    if (preview.nodes.length > 0) {
      await tx.roadmapNode.updateMany({
        where: { id: { in: preview.nodes.map((node) => node.id) } },
        data:
          input.operation === 'BLOCK'
            ? { isTeacherBlocked: true }
            : { isTeacherBlocked: false, teacherUnlockOn: null },
      });
    }
    // Unlocking a prerequisite can release dependents whose scheduled day already arrived.
    if (input.operation !== 'BLOCK') await releaseDueScheduledUnlocks(tx, roadmap.id);
    return { result: preview, facts: [] };
  },
});

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

/** A Scheduled unlock date; it changes nobody's access until the day arrives. */
export const scheduleTeacherUnlock = roadmapCommand({
  capability: 'edit',
  parse: ({ id, unlockOn }: { id: string; unlockOn: unknown }) => {
    const nodeId = requireUuid(id, 'nodeId');
    // One clock read: the Node's rule in `run` decides against the same day.
    const today = chileCalendarDay();
    const decision = decideScheduledUnlockDay({ unlockOn, today });
    if (decision.kind === 'REJECTED') throw ruleError(decision);
    return { nodeId, day: decision.day, today };
  },
  access: 'none',
  run: async ({ tx, roadmap, input: { nodeId, day, today } }) => {
    const node = await requireNode(tx, nodeId, roadmap.id);
    const decision = decideScheduledUnlock({ node, unlockOn: day, today });
    if (decision.kind === 'REJECTED') throw ruleError(decision);
    await tx.roadmapNode.update({
      where: { id: node.id },
      data: { teacherUnlockOn: decision.day ? calendarDayDate(decision.day) : null },
    });
    return { result: { teacherUnlockOn: decision.day }, facts: [] };
  },
});

/** A Roadmap closed (or removed) since the pass listed it releases nothing. */
function nothingReleasedOnClosure(error: unknown): string[] {
  const refusals = ['ROADMAP_CLOSED', 'ROADMAP_NOT_FOUND'];
  if (error instanceof ApplicationError && refusals.includes(error.code)) return [];
  throw error;
}

/** Releases every due scheduled unlock; run by the daily scheduled job. */
export const releaseScheduledTeacherUnlocks = async (
  changePort: RoadmapChangePort,
  today: CalendarDay = chileCalendarDay(),
) => {
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
    const releasedNodeIds = await roadmapChangeTransaction(
      changePort,
      (transaction, report) =>
        changeRoadmap(
          transaction,
          report,
          {
            roadmapId: roadmap.id,
            identifier: roadmap.courseOffering,
            actorId: SCHEDULED_UNLOCK_ACTOR_ID,
            access: 'roadmap',
            lock: 'update',
          },
          async () => ({
            result: [...(await releaseDueScheduledUnlocks(transaction, roadmap.id, today))],
            facts: [],
          }),
        ),
      { conflictMessage: 'El desbloqueo programado entra en conflicto con otra modificación.' },
    ).catch(nothingReleasedOnClosure);
    released.push({ identifier: roadmap.courseOffering, releasedNodeIds });
  }
  return released;
};
