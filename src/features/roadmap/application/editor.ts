import 'server-only';

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
import {
  getAvailableTypes,
  nodeDto,
  nodeTypeDto,
  resourceDto,
} from '@/features/roadmap/application/roadmap';
import {
  nodeDescription,
  optionalString,
  requireBoolean,
  requireNodeTypeColor,
  requireNodeTypeIcon,
  requireFiniteNumber,
  requireString,
} from '@/features/roadmap/application/validation';
import {
  decideNodeTypeChange,
  nodeTypeNotFound,
  normalizeName,
  type NodeTypeChange,
  type NodeTypeRuleFailure,
} from '@/features/roadmap/domain/node-type';
import {
  confirmChange,
  planChange,
  type ChangeConsequences,
  type ChangeRuleFailure,
  type ChangeWithImpact,
  type RoadmapSnapshot,
  type StaleChangeImpactReason,
} from '@/features/roadmap/domain/change-impact';
import { requireUuid } from '@/shared/validation';
import { ApplicationError } from '@/shared/errors/server';
import type { ApplicationErrorStatus } from '@/shared/errors/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';
import type { RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import {
  chileCalendarDay,
  decideScheduledUnlock,
  decideScheduledUnlockDay,
  dueScheduledUnlockNodeIds,
  type CalendarDay,
  type ScheduledUnlockRuleFailure,
} from '@/features/roadmap/domain/scheduled-unlock';
import { cleanupStoredFiles } from '@/features/roadmap/infrastructure/resources/lifecycle';

type JsonObject = Record<string, unknown>;

export const SCHEDULED_UNLOCK_ACTOR_ID = '00000000-0000-0000-0000-000000000000';

function dependencyFact(
  nodes: readonly { id: string; title: string; isVisible: boolean }[],
  { id, sourceNodeId, targetNodeId }: { id: string; sourceNodeId: string; targetNodeId: string },
  change: 'created' | 'removed',
): RoadmapChangeFact {
  const nodeFacts = (nodeId: string) => {
    const { title, isVisible } = nodes.find((node) => node.id === nodeId)!;
    return { title, isVisible };
  };
  return {
    kind: 'dependency',
    dependencyId: id,
    sourceNodeId,
    targetNodeId,
    previous: change === 'removed',
    current: change === 'created',
    sourceNode: nodeFacts(sourceNodeId),
    targetNode: nodeFacts(targetNodeId),
  };
}

type RoadmapRuleFailure =
  ChangeRuleFailure | ScheduledUnlockRuleFailure | NodeTypeRuleFailure | StaleChangeImpactReason;

const RULE_FAILURE_STATUS: Readonly<Record<RoadmapRuleFailure, ApplicationErrorStatus>> = {
  NODE_NOT_FOUND: 404,
  SELF_DEPENDENCY: 409,
  HIDDEN_NODE_DEPENDENCY_FORBIDDEN: 403,
  DEPENDENCY_CONFLICT: 409,
  DEPENDENCY_CYCLE: 409,
  HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN: 409,
  INVALID_TEACHER_UNLOCK_DATE: 400,
  TEACHER_UNLOCK_SCHEDULE_REQUIRES_BLOCK: 409,
  NODE_TYPE_NOT_FOUND: 404,
  PREDEFINED_TYPE_IMMUTABLE: 409,
  NODE_TYPE_NAME_CONFLICT: 409,
  NODE_TYPE_IN_USE: 409,
  NODE_VISIBILITY_PREVIEW_STALE: 409,
  NODE_DELETE_PREVIEW_STALE: 409,
  DEPENDENCY_PREVIEW_STALE: 409,
  TEACHER_BLOCK_PREVIEW_STALE: 409,
};

function ruleError({ reason, message }: RuleRejection<RoadmapRuleFailure>) {
  return new ApplicationError(RULE_FAILURE_STATUS[reason], reason, message);
}

async function loadRoadmapSnapshot(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  today = chileCalendarDay(),
): Promise<RoadmapSnapshot> {
  const [nodes, dependencies, nodeTypes] = await Promise.all([
    transaction.roadmapNode.findMany({
      where: { roadmapId },
      select: {
        id: true,
        title: true,
        nodeTypeId: true,
        isVisible: true,
        isTeacherBlocked: true,
        teacherUnlockOn: true,
        teacherUnlockIncludesDependents: true,
        resources: { select: { id: true, title: true } },
      },
    }),
    transaction.dependency.findMany({
      where: { sourceNode: { roadmapId } },
      select: { id: true, sourceNodeId: true, targetNodeId: true },
    }),
    getAvailableTypes(roadmapId, transaction),
  ]);
  return {
    nodes: nodes.map(({ teacherUnlockOn, ...node }) => ({
      ...node,
      teacherUnlockOn: teacherUnlockOn ? calendarDayOf(teacherUnlockOn) : null,
    })),
    dependencies,
    nodeTypes,
    today,
  };
}

async function persistConsequences(
  transaction: Prisma.TransactionClient,
  { blockedNodeIds, unblockedNodeIds, removedDependencyIds }: ChangeConsequences,
) {
  if (blockedNodeIds.length > 0)
    await transaction.roadmapNode.updateMany({
      where: { id: { in: blockedNodeIds } },
      data: { isTeacherBlocked: true },
    });
  if (unblockedNodeIds.length > 0)
    await transaction.roadmapNode.updateMany({
      where: { id: { in: unblockedNodeIds } },
      data: {
        isTeacherBlocked: false,
        teacherUnlockOn: null,
        teacherUnlockIncludesDependents: false,
      },
    });
  if (removedDependencyIds.length > 0)
    await transaction.dependency.deleteMany({ where: { id: { in: removedDependencyIds } } });
}

function readChangeImpact<Change extends ChangeWithImpact>(
  participant: RoadmapParticipant,
  change: Change,
) {
  return roadmapRead(participant, 'edit', async ({ tx, roadmap }) => {
    const plan = planChange(await loadRoadmapSnapshot(tx, roadmap.id), change);
    if (plan.kind === 'REJECTED') throw ruleError(plan);
    return plan.impact;
  });
}

async function persistConfirmedChange<Change extends ChangeWithImpact>(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  change: Change,
  previewVersion: string | undefined,
) {
  const snapshot = await loadRoadmapSnapshot(transaction, roadmapId);
  const plan = confirmChange(snapshot, change, previewVersion);
  if (plan.kind === 'REJECTED') throw ruleError(plan);
  await persistConsequences(transaction, plan.consequences);
  return { snapshot, impact: plan.impact };
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
  if (!nodeType) throw ruleError(nodeTypeNotFound());
  return nodeType;
}

async function decideNodeType(
  transaction: Prisma.TransactionClient,
  roadmapId: string,
  change: NodeTypeChange,
) {
  const nodeTypes = await transaction.nodeType.findMany({
    where: { OR: [{ isPredefined: true }, { roadmapId }] },
    select: { id: true, name: true, isPredefined: true },
  });
  const nodes =
    change.kind === 'delete'
      ? await transaction.roadmapNode.findMany({
          where: { nodeTypeId: change.nodeTypeId },
          select: { nodeTypeId: true },
        })
      : [];
  const decision = decideNodeTypeChange({ nodeTypes, nodes, change });
  if (decision.kind === 'REJECTED') throw ruleError(decision);
  return nodeTypes;
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

export const updateRoadmapNode = roadmapCommand({
  capability: 'edit',
  parse: ({
    id,
    input,
    previewVersion,
  }: {
    id: string;
    input: JsonObject;
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
    const hiding =
      changes.isVisible === false
        ? await persistConfirmedChange(
            tx,
            roadmap.id,
            { kind: 'hide-node', nodeId },
            previewVersion,
          )
        : null;
    const removedDependencies = hiding?.impact.dependencies ?? [];
    const updated = await tx.roadmapNode.update({
      where: { id: node.id },
      data: changes,
      include: { resources: { orderBy: { title: 'asc' } } },
    });
    const [previousType, currentType] =
      changes.nodeTypeId && changes.nodeTypeId !== node.nodeTypeId
        ? await Promise.all([
            requireType(tx, node.nodeTypeId, roadmap.id),
            requireType(tx, changes.nodeTypeId, roadmap.id),
          ])
        : [null, null];
    const nodes =
      hiding?.snapshot.nodes.map((current) => (current.id === node.id ? updated : current)) ?? [];
    const facts = removedDependencies.map((dependency) =>
      dependencyFact(nodes, dependency, 'removed'),
    );
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

export const previewNodeDeletion = async ({
  id,
  ...participant
}: RoadmapParticipant & { id: string }) => {
  return readChangeImpact(participant, { kind: 'delete-node', nodeId: requireUuid(id, 'nodeId') });
};

const nodeDeletion = roadmapCommand({
  capability: 'edit',
  parse: ({ id, previewVersion }: { id: string; previewVersion?: string }) => ({
    nodeId: requireUuid(id, 'nodeId'),
    previewVersion,
  }),
  access: 'roadmap',
  conflictMessage: 'La eliminación entra en conflicto con otra modificación.',
  run: async ({ tx, roadmap, input: { nodeId, previewVersion } }) => {
    const { impact } = await persistConfirmedChange(
      tx,
      roadmap.id,
      { kind: 'delete-node', nodeId },
      previewVersion,
    );
    const resources = await tx.resource.findMany({
      where: { roadmapNodeId: nodeId, fileKey: { not: null } },
      select: { fileKey: true },
    });
    const node = await tx.roadmapNode.delete({ where: { id: nodeId } });
    return {
      result: resources.flatMap(({ fileKey }) => (fileKey ? [fileKey] : [])),
      facts: [
        {
          kind: 'node-deleted',
          nodeId,
          nodeTypeName: impact.node.nodeType.name,
          previous: node,
          current: null,
        },
      ],
    };
  },
});

export const deleteRoadmapNode = async (
  request: Parameters<typeof nodeDeletion>[0],
  changePort: RoadmapChangePort,
) => {
  const fileKeys = await nodeDeletion(request, changePort);
  await cleanupStoredFiles('delete Node', fileKeys);
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
    await decideNodeType(tx, roadmap.id, { kind: 'create', name });
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
    const { name } = changes;
    const nodeTypes = await decideNodeType(tx, roadmap.id, {
      kind: 'update',
      nodeTypeId: typeId,
      name,
    });
    const previous = nodeTypes.find(({ id }) => id === typeId)?.name;
    const updated = await tx.nodeType.update({
      where: { id: typeId },
      data: name === undefined ? changes : { ...changes, normalizedName: normalizeName(name) },
    });
    return {
      result: { nodeType: nodeTypeDto(updated) },
      facts:
        previous !== undefined && updated.name !== previous
          ? [{ kind: 'node-type-name', nodeTypeId: typeId, previous, current: updated.name }]
          : [],
    };
  },
});

export const deleteRoadmapNodeType = roadmapCommand({
  capability: 'edit',
  parse: ({ id }: { id: string }) => requireUuid(id, 'typeId'),
  access: 'none',
  run: async ({ tx, roadmap, input: typeId }) => {
    await decideNodeType(tx, roadmap.id, { kind: 'delete', nodeTypeId: typeId });
    await tx.nodeType.delete({ where: { id: typeId } });
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

function dependencyChange({ sourceNodeId, targetNodeId }: ReturnType<typeof parseDependency>) {
  return { kind: 'create-dependency', sourceNodeId, targetNodeId } as const;
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
    const { snapshot, impact } = await persistConfirmedChange(
      tx,
      roadmap.id,
      dependencyChange(input),
      previewVersion,
    );
    const dependency = await tx.dependency.create({ data: input });
    return {
      result: { dependency: { id: dependency.id, ...input }, nodes: impact.nodes },
      facts: [dependencyFact(snapshot.nodes, { ...input, id: dependency.id }, 'created')],
    };
  },
});

export const previewRoadmapDependency = async ({
  input,
  ...participant
}: RoadmapParticipant & { input: JsonObject }) => {
  return readChangeImpact(participant, dependencyChange(parseDependency({ input })));
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
  return readChangeImpact(participant, { kind: 'hide-node', nodeId: requireUuid(id, 'nodeId') });
};

type TeacherBlockRequest = { id: string; operation: TeacherBlockOperation };

function teacherBlockChange({ id, operation }: TeacherBlockRequest) {
  return { kind: 'change-teacher-block', nodeId: requireUuid(id, 'nodeId'), operation } as const;
}

export const previewTeacherBlock = async ({
  id,
  operation,
  ...participant
}: RoadmapParticipant & TeacherBlockRequest) => {
  return readChangeImpact(participant, teacherBlockChange({ id, operation }));
};

export const changeTeacherBlock = roadmapCommand({
  capability: 'edit',
  parse: ({ previewVersion, ...request }: TeacherBlockRequest & { previewVersion?: string }) => ({
    change: teacherBlockChange(request),
    previewVersion,
  }),
  access: 'roadmap',
  run: async ({ tx, roadmap, input: { change, previewVersion } }) => {
    const { impact } = await persistConfirmedChange(tx, roadmap.id, change, previewVersion);
    return { result: impact, facts: [] };
  },
});

function calendarDayOf(date: Date): CalendarDay {
  return date.toISOString().slice(0, 10);
}

function calendarDayDate(day: CalendarDay) {
  return new Date(`${day}T00:00:00.000Z`);
}

export const scheduleTeacherUnlock = roadmapCommand({
  capability: 'edit',
  parse: ({
    id,
    unlockOn,
    includeDependents,
  }: {
    id: string;
    unlockOn: unknown;
    includeDependents?: unknown;
  }) => {
    const nodeId = requireUuid(id, 'nodeId');
    const today = chileCalendarDay();
    const decision = decideScheduledUnlockDay({ unlockOn, includeDependents, today });
    if (decision.kind === 'REJECTED') throw ruleError(decision);
    return { nodeId, day: decision.day, includesDependents: decision.includesDependents, today };
  },
  access: 'none',
  run: async ({ tx, roadmap, input: { nodeId, day, includesDependents, today } }) => {
    const node = await requireNode(tx, nodeId, roadmap.id);
    const decision = decideScheduledUnlock({
      node,
      unlockOn: day,
      includeDependents: includesDependents,
      today,
    });
    if (decision.kind === 'REJECTED') throw ruleError(decision);
    await tx.roadmapNode.update({
      where: { id: node.id },
      data: {
        teacherUnlockOn: decision.day ? calendarDayDate(decision.day) : null,
        teacherUnlockIncludesDependents: decision.includesDependents,
      },
    });
    return {
      result: {
        teacherUnlockOn: decision.day,
        teacherUnlockIncludesDependents: decision.includesDependents,
      },
      facts: [],
    };
  },
});

function nothingReleasedOnClosure(error: unknown): string[] {
  const refusals = ['ROADMAP_CLOSED', 'ROADMAP_NOT_FOUND'];
  if (error instanceof ApplicationError && refusals.includes(error.code)) return [];
  throw error;
}

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
    try {
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
            async () => {
              const unblockedNodeIds = [
                ...dueScheduledUnlockNodeIds(
                  await loadRoadmapSnapshot(transaction, roadmap.id, today),
                ),
              ];
              await persistConsequences(transaction, {
                blockedNodeIds: [],
                unblockedNodeIds,
                removedDependencyIds: [],
              });
              return { result: unblockedNodeIds, facts: [] };
            },
          ),
        { conflictMessage: 'El desbloqueo programado entra en conflicto con otra modificación.' },
      ).catch(nothingReleasedOnClosure);
      released.push({ identifier: roadmap.courseOffering, releasedNodeIds });
    } catch (error) {
      console.warn('Scheduled unlock release failed', {
        roadmapId: roadmap.id,
        identifier: roadmap.courseOffering,
        error,
      });
    }
  }
  return released;
};
