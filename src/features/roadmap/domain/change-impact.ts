import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
  visibleRoadmapGraph,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import {
  dueScheduledUnlockNodeIds,
  type CalendarDay,
} from '@/features/roadmap/domain/scheduled-unlock';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import type {
  DependencyImpact,
  NodeDeletionImpact,
  NodeHidingImpact,
  TeacherBlockImpact,
  TeacherBlockOperation,
  TeacherBlockOperationImpact,
  TeacherBlockUnlockMode,
} from '@/features/roadmap/types';

export type RoadmapSnapshot = {
  nodes: readonly {
    id: string;
    title: string;
    nodeTypeId: string;
    isVisible: boolean;
    isTeacherBlocked: boolean;
    teacherUnlockOn: CalendarDay | null;
    resources: readonly { id: string; title: string }[];
  }[];
  dependencies: readonly { id: string; sourceNodeId: string; targetNodeId: string }[];
  nodeTypes: readonly { id: string; name: string; icon: string; color: string }[];
  today: CalendarDay;
};

export type ChangeWithImpact =
  | { kind: 'create-dependency'; sourceNodeId: string; targetNodeId: string }
  | { kind: 'change-teacher-block'; nodeId: string; operation: TeacherBlockOperation }
  | { kind: 'hide-node' | 'delete-node'; nodeId: string };

export type ChangeImpactOf = {
  'create-dependency': DependencyImpact;
  'change-teacher-block': TeacherBlockOperationImpact;
  'hide-node': NodeHidingImpact;
  'delete-node': NodeDeletionImpact;
};

export type ChangeConsequences = {
  blockedNodeIds: string[];
  unblockedNodeIds: string[];
  removedDependencyIds: string[];
};

export type ChangeRuleFailure =
  | 'SELF_DEPENDENCY'
  | 'NODE_NOT_FOUND'
  | 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN'
  | 'DEPENDENCY_CONFLICT'
  | 'DEPENDENCY_CYCLE'
  | 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN';

export type StaleChangeImpactReason =
  | 'NODE_VISIBILITY_PREVIEW_STALE'
  | 'NODE_DELETE_PREVIEW_STALE'
  | 'DEPENDENCY_PREVIEW_STALE'
  | 'TEACHER_BLOCK_PREVIEW_STALE';

export type ChangePlan<Kind extends ChangeWithImpact['kind'] = ChangeWithImpact['kind']> =
  | {
      kind: 'ALLOWED';
      impact: ChangeImpactOf[Kind];
      consequences: ChangeConsequences;
      stale: RuleRejection<StaleChangeImpactReason>;
    }
  | RuleRejection<ChangeRuleFailure>;

export function planChange<Change extends ChangeWithImpact>(
  snapshot: RoadmapSnapshot,
  change: Change,
): ChangePlan<Change['kind']> {
  return planAnyChange(snapshot, change) as ChangePlan<Change['kind']>;
}

function planAnyChange(snapshot: RoadmapSnapshot, change: ChangeWithImpact): ChangePlan {
  switch (change.kind) {
    case 'create-dependency':
      return planDependency(snapshot, change);
    case 'change-teacher-block':
      return planTeacherBlock(snapshot, change);
    case 'hide-node':
      return planHiding(snapshot, change.nodeId);
    case 'delete-node':
      return planDeletion(snapshot, change.nodeId);
  }
}

export function confirmChange<Change extends ChangeWithImpact>(
  snapshot: RoadmapSnapshot,
  change: Change,
  previewVersion: string | undefined,
): ChangePlan<Change['kind']> | RuleRejection<StaleChangeImpactReason> {
  const plan = planChange(snapshot, change);
  return plan.kind === 'REJECTED' || plan.impact.version === previewVersion ? plan : plan.stale;
}

function staleImpact(reason: StaleChangeImpactReason, impact: string) {
  return ruleRejection(
    reason,
    `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
  );
}

function planHiding(snapshot: RoadmapSnapshot, nodeId: string): ChangePlan<'hide-node'> {
  if (!nodeOf(snapshot, nodeId)) return nodeNotFound();
  const dependencies = dependenciesTouching(snapshot, nodeId).map(
    ({ id, sourceNodeId, targetNodeId }) => ({ id, sourceNodeId, targetNodeId }),
  );
  return {
    kind: 'ALLOWED',
    impact: versionChangeImpact({ dependencies }),
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: [nodeId],
      removedDependencyIds: dependencies.map(({ id }) => id),
    },
    stale: staleImpact('NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'),
  };
}

function planDeletion(snapshot: RoadmapSnapshot, nodeId: string): ChangePlan<'delete-node'> {
  const node = nodeOf(snapshot, nodeId);
  if (!node) return nodeNotFound();
  const dependencies = dependenciesTouching(snapshot, nodeId);
  return {
    kind: 'ALLOWED',
    impact: versionChangeImpact({
      node: { title: node.title, nodeType: nodeTypeOf(snapshot, node.nodeTypeId) },
      dependencies: dependencies.map(({ id, sourceNodeId, targetNodeId }) => ({
        id,
        sourceTitle: nodeOf(snapshot, sourceNodeId)!.title,
        targetTitle: nodeOf(snapshot, targetNodeId)!.title,
      })),
      resources: [...node.resources].sort(byTitle).map(({ id, title }) => ({ id, title })),
    }),
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: [],
      removedDependencyIds: dependencies.map(({ id }) => id),
    },
    stale: staleImpact('NODE_DELETE_PREVIEW_STALE', 'de la eliminación'),
  };
}

function nodeOf(snapshot: RoadmapSnapshot, nodeId: string) {
  return snapshot.nodes.find(({ id }) => id === nodeId);
}

function nodeNotFound() {
  return ruleRejection('NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
}

function dependenciesTouching(snapshot: RoadmapSnapshot, nodeId: string) {
  return snapshot.dependencies
    .filter(({ sourceNodeId, targetNodeId }) => sourceNodeId === nodeId || targetNodeId === nodeId)
    .sort(byId);
}

function planDependency(
  snapshot: RoadmapSnapshot,
  { sourceNodeId, targetNodeId }: Extract<ChangeWithImpact, { kind: 'create-dependency' }>,
): ChangePlan<'create-dependency'> {
  if (sourceNodeId === targetNodeId)
    return ruleRejection('SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const sourceNode = nodeOf(snapshot, sourceNodeId);
  const targetNode = nodeOf(snapshot, targetNodeId);
  if (!sourceNode || !targetNode) return nodeNotFound();
  if (!sourceNode.isVisible || !targetNode.isVisible)
    return ruleRejection(
      'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
      'No se pueden crear dependencias con nodos ocultos.',
    );
  if (
    snapshot.dependencies.some(
      (dependency) =>
        dependency.sourceNodeId === sourceNodeId && dependency.targetNodeId === targetNodeId,
    )
  )
    return ruleRejection('DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
  if (wouldCreateDependencyCycle(snapshot.dependencies, sourceNodeId, targetNodeId))
    return ruleRejection('DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
  const nodes = sourceNode.isTeacherBlocked ? cascadingTeacherBlock(snapshot, targetNodeId) : [];
  return {
    kind: 'ALLOWED',
    impact: versionChangeImpact({ nodes }),
    consequences: {
      blockedNodeIds: nodes.map(({ id }) => id),
      unblockedNodeIds: [],
      removedDependencyIds: [],
    },
    stale: staleImpact('DEPENDENCY_PREVIEW_STALE', 'de la dependencia'),
  };
}

function planTeacherBlock(
  snapshot: RoadmapSnapshot,
  { nodeId, operation }: Extract<ChangeWithImpact, { kind: 'change-teacher-block' }>,
): ChangePlan<'change-teacher-block'> {
  const selectedNode = nodeOf(snapshot, nodeId);
  if (!selectedNode) return nodeNotFound();
  if (!selectedNode.isVisible)
    return ruleRejection(
      'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
      'Un nodo oculto no puede tener un bloqueo docente.',
    );
  const { mode, changedNodeIds } = teacherBlockScope(snapshot, nodeId, operation);
  const nodes = snapshot.nodes
    .filter(({ id }) => changedNodeIds.has(id))
    .sort(byTitle)
    .map(({ id, title, nodeTypeId }): TeacherBlockImpact => ({
      id,
      title,
      nodeType: nodeTypeOf(snapshot, nodeTypeId),
      relation:
        id === nodeId ? 'SELECTED_NODE' : mode === 'UPSTREAM' ? 'PREREQUISITE' : 'DEPENDENT',
    }));
  const nodeIds = nodes.map(({ id }) => id);
  return {
    kind: 'ALLOWED',
    impact: versionChangeImpact({ mode, nodes }),
    consequences:
      mode === 'BLOCK'
        ? { blockedNodeIds: nodeIds, unblockedNodeIds: [], removedDependencyIds: [] }
        : {
            blockedNodeIds: [],
            unblockedNodeIds: [...nodeIds, ...releasedScheduledUnlocks(snapshot, changedNodeIds)],
            removedDependencyIds: [],
          },
    stale: staleImpact(
      'TEACHER_BLOCK_PREVIEW_STALE',
      mode === 'BLOCK' ? 'del bloqueo' : 'del desbloqueo',
    ),
  };
}

function releasedScheduledUnlocks(snapshot: RoadmapSnapshot, unlockedNodeIds: ReadonlySet<string>) {
  return dueScheduledUnlockNodeIds({
    ...snapshot,
    nodes: snapshot.nodes.map((node) =>
      unlockedNodeIds.has(node.id) ? { ...node, isTeacherBlocked: false } : node,
    ),
  });
}

function teacherBlockScope(
  snapshot: RoadmapSnapshot,
  nodeId: string,
  operation: TeacherBlockOperation,
): { mode: TeacherBlockUnlockMode; changedNodeIds: ReadonlySet<string> } {
  if (operation === 'BLOCK')
    return {
      mode: 'BLOCK',
      changedNodeIds: new Set(cascadingTeacherBlock(snapshot, nodeId).map(({ id }) => id)),
    };
  const teacherBlockedNodeIds = new Set(
    snapshot.nodes.filter((node) => node.isTeacherBlocked).map(({ id }) => id),
  );
  const prerequisiteNodeIds = transitivePrerequisiteNodeIds(snapshot.dependencies, nodeId);
  if ([...prerequisiteNodeIds].some((id) => teacherBlockedNodeIds.has(id)))
    return {
      mode: 'UPSTREAM',
      changedNodeIds: new Set(
        [nodeId, ...prerequisiteNodeIds].filter((id) => teacherBlockedNodeIds.has(id)),
      ),
    };
  if (operation === 'UNBLOCK')
    return {
      mode: 'SINGLE',
      changedNodeIds: new Set(teacherBlockedNodeIds.has(nodeId) ? [nodeId] : []),
    };
  return {
    mode: 'BRANCH',
    changedNodeIds: eligibleBranchUnlockNodeIds({
      dependencies: snapshot.dependencies,
      teacherBlockedNodeIds,
      rootNodeId: nodeId,
    }),
  };
}

function nodeTypeOf(snapshot: RoadmapSnapshot, nodeTypeId: string) {
  const { name, icon, color } =
    snapshot.nodeTypes.find(({ id }) => id === nodeTypeId) ?? unknownNodeType;
  return { name, icon, color };
}

function versionChangeImpact<Impact extends object>(impact: Impact) {
  const content = JSON.stringify(impact);
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  for (let index = 0; index < content.length; index++) {
    const code = content.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507);
  first ^= Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507);
  second ^= Math.imul(first ^ (first >>> 13), 3266489909);
  const hash = 4294967296 * (2097151 & second) + (first >>> 0);
  return { ...impact, version: hash.toString(36) };
}

const titleCollator = new Intl.Collator('es');

function byTitle(left: { id: string; title: string }, right: { id: string; title: string }) {
  return titleCollator.compare(left.title, right.title) || byId(left, right);
}

function byId(left: { id: string }, right: { id: string }) {
  return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
}

function cascadingTeacherBlock(snapshot: RoadmapSnapshot, nodeId: string) {
  const { nodes, dependencies } = visibleRoadmapGraph(snapshot.nodes, snapshot.dependencies);
  const reachedNodeIds = new Set([nodeId, ...transitiveDependentNodeIds(dependencies, nodeId)]);
  return nodes
    .filter((node) => !node.isTeacherBlocked && reachedNodeIds.has(node.id))
    .map(({ id, title }) => ({ id, title }))
    .sort(byTitle);
}
