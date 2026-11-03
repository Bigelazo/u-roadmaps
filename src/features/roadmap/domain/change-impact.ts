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
  TeacherBlockPreview,
  TeacherBlockUnlockMode,
} from '@/features/roadmap/types';

/** The part of a teaching Roadmap that the Change impact rules read. */
export type RoadmapSnapshot = {
  nodes: readonly {
    id: string;
    title: string;
    nodeTypeId: string;
    isVisible: boolean;
    isTeacherBlocked: boolean;
    teacherUnlockOn?: CalendarDay | null;
    resources: readonly { id: string; title: string }[];
  }[];
  dependencies: readonly { id: string; sourceNodeId: string; targetNodeId: string }[];
  nodeTypes: readonly { id: string; name: string; icon: string; color: string }[];
  today: CalendarDay;
};

/** A Confirmed action that has a Change impact. */
export type RoadmapChange =
  | { kind: 'create-dependency'; sourceNodeId: string; targetNodeId: string }
  | { kind: 'change-teacher-block'; nodeId: string; operation: TeacherBlockOperation }
  | { kind: 'hide-node' | 'delete-node'; nodeId: string };

type ChangeImpactOf = {
  'create-dependency': DependencyImpact;
  'change-teacher-block': TeacherBlockPreview;
  'hide-node': NodeHidingImpact;
  'delete-node': NodeDeletionImpact;
};

/** What a change does besides its primary change, for each adapter to persist in its storage. */
export type ChangeConsequences = {
  /** Nodes that receive a Teacher block. */
  blockedNodeIds: string[];
  /** Nodes whose Teacher block is removed, which also discards their Scheduled unlock. */
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

export type ChangePlan<Kind extends RoadmapChange['kind'] = RoadmapChange['kind']> =
  | { kind: 'ALLOWED'; impact: ChangeImpactOf[Kind]; consequences: ChangeConsequences }
  | RuleRejection<ChangeRuleFailure>;

/** Plans a change for its preview: its rule rejection, or its versioned Change impact and consequences. */
export function planChange<Change extends RoadmapChange>(
  snapshot: RoadmapSnapshot,
  change: Change,
): ChangePlan<Change['kind']> {
  // TypeScript cannot narrow the generic result per kind; each kind plans its own Change impact.
  return planAnyChange(snapshot, change) as ChangePlan<Change['kind']>;
}

function planAnyChange(snapshot: RoadmapSnapshot, change: RoadmapChange): ChangePlan {
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

/** Plans a change for its confirmation, refusing it as stale unless `previewVersion` is still current. */
export function confirmChange<Change extends RoadmapChange>(
  snapshot: RoadmapSnapshot,
  change: Change,
  previewVersion: string | undefined,
): ChangePlan<Change['kind']> | RuleRejection<StaleChangeImpactReason> {
  const plan = planChange(snapshot, change);
  if (plan.kind === 'REJECTED' || plan.impact.version === previewVersion) return plan;
  const anyChange: RoadmapChange = change;
  const [reason, impact] =
    staleImpacts[anyChange.kind === 'change-teacher-block' ? anyChange.operation : anyChange.kind];
  return ruleRejection(
    reason,
    `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
  );
}

const staleImpacts = {
  'hide-node': ['NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  'delete-node': ['NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
  'create-dependency': ['DEPENDENCY_PREVIEW_STALE', 'de la dependencia'],
  BLOCK: ['TEACHER_BLOCK_PREVIEW_STALE', 'del bloqueo'],
  UNBLOCK: ['TEACHER_BLOCK_PREVIEW_STALE', 'del desbloqueo'],
  BRANCH_UNLOCK: ['TEACHER_BLOCK_PREVIEW_STALE', 'del desbloqueo'],
} as const;

export type StaleChangeImpactReason = (typeof staleImpacts)[keyof typeof staleImpacts][0];

function planHiding(snapshot: RoadmapSnapshot, nodeId: string): ChangePlan<'hide-node'> {
  if (!snapshot.nodes.some(({ id }) => id === nodeId)) return nodeNotFound();
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
  };
}

function planDeletion(snapshot: RoadmapSnapshot, nodeId: string): ChangePlan<'delete-node'> {
  const node = snapshot.nodes.find(({ id }) => id === nodeId);
  if (!node) return nodeNotFound();
  const titleOf = (id: string) => snapshot.nodes.find((candidate) => candidate.id === id)!.title;
  const dependencies = dependenciesTouching(snapshot, nodeId);
  return {
    kind: 'ALLOWED',
    impact: versionChangeImpact({
      node: { title: node.title, nodeType: nodeTypeOf(snapshot, node.nodeTypeId) },
      dependencies: dependencies.map(({ id, sourceNodeId, targetNodeId }) => ({
        id,
        sourceTitle: titleOf(sourceNodeId),
        targetTitle: titleOf(targetNodeId),
      })),
      resources: [...node.resources].sort(byTitle).map(({ id, title }) => ({ id, title })),
    }),
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: [],
      removedDependencyIds: dependencies.map(({ id }) => id),
    },
  };
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
  { sourceNodeId, targetNodeId }: Extract<RoadmapChange, { kind: 'create-dependency' }>,
): ChangePlan<'create-dependency'> {
  if (sourceNodeId === targetNodeId)
    return ruleRejection('SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const sourceNode = snapshot.nodes.find(({ id }) => id === sourceNodeId);
  const targetNode = snapshot.nodes.find(({ id }) => id === targetNodeId);
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
  };
}

function planTeacherBlock(
  snapshot: RoadmapSnapshot,
  { nodeId, operation }: Extract<RoadmapChange, { kind: 'change-teacher-block' }>,
): ChangePlan<'change-teacher-block'> {
  const selectedNode = snapshot.nodes.find(({ id }) => id === nodeId);
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
  };
}

/** The Nodes whose due Scheduled unlock no Teacher-blocked prerequisite holds once `unlockedNodeIds` are unlocked. */
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

/**
 * Versions a Change impact by its content with a short, deterministic, non-cryptographic hash
 * (cyrb53), so the version fits an HTTP header whatever the Node titles are. The server always
 * recomputes the Change impact, so a forged version gains nothing beyond a fresh preview.
 */
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

/** The visible Nodes without a Teacher block from `nodeId` onwards, which a blocked prerequisite would block. */
function cascadingTeacherBlock(snapshot: RoadmapSnapshot, nodeId: string) {
  const { nodes, dependencies } = visibleRoadmapGraph(snapshot.nodes, snapshot.dependencies);
  const reachedNodeIds = new Set([nodeId, ...transitiveDependentNodeIds(dependencies, nodeId)]);
  return nodes
    .filter((node) => !node.isTeacherBlocked && reachedNodeIds.has(node.id))
    .map(({ id, title }) => ({ id, title }))
    .sort(byTitle);
}
