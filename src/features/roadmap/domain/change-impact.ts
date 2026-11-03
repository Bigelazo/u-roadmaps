import {
  transitiveDependentNodeIds,
  visibleRoadmapGraph,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';
import type { CalendarDay } from '@/features/roadmap/domain/scheduled-unlock';
import type { DependencyImpact } from '@/features/roadmap/types';

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
export type RoadmapChange = {
  kind: 'create-dependency';
  sourceNodeId: string;
  targetNodeId: string;
};

/** What a change does besides its primary change, for each adapter to persist in its storage. */
export type ChangeConsequences = {
  /** Nodes that receive a Teacher block. */
  blockedNodeIds: string[];
  /** Nodes whose Teacher block is removed, which also discards their Scheduled unlock. */
  unblockedNodeIds: string[];
  removedDependencyIds: string[];
};

export type DependencyRuleFailure =
  | 'SELF_DEPENDENCY'
  | 'NODE_NOT_FOUND'
  | 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN'
  | 'DEPENDENCY_CONFLICT'
  | 'DEPENDENCY_CYCLE';

export type ChangePlan =
  | { kind: 'ALLOWED'; impact: DependencyImpact; consequences: ChangeConsequences }
  | RuleRejection<DependencyRuleFailure>;

/** Plans a change for its preview: its rule rejection, or its versioned Change impact and consequences. */
export function planChange(snapshot: RoadmapSnapshot, change: RoadmapChange): ChangePlan {
  return planDependency(snapshot, change);
}

/** Plans a change for its confirmation, refusing it as stale unless `previewVersion` is still current. */
export function confirmChange(
  snapshot: RoadmapSnapshot,
  change: RoadmapChange,
  previewVersion: string | undefined,
): ChangePlan | RuleRejection<StaleChangeImpactReason> {
  const plan = planChange(snapshot, change);
  if (plan.kind === 'REJECTED') return plan;
  const decision = decideChangeImpactVersion({
    change: 'dependency',
    sentVersion: previewVersion,
    version: plan.impact.version,
  });
  return decision.kind === 'REJECTED' ? decision : plan;
}

function planDependency(
  snapshot: RoadmapSnapshot,
  { sourceNodeId, targetNodeId }: Extract<RoadmapChange, { kind: 'create-dependency' }>,
): ChangePlan {
  if (sourceNodeId === targetNodeId)
    return ruleRejection('SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const sourceNode = snapshot.nodes.find(({ id }) => id === sourceNodeId);
  const targetNode = snapshot.nodes.find(({ id }) => id === targetNodeId);
  if (!sourceNode || !targetNode)
    return ruleRejection('NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
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

/**
 * Versions a Change impact by its content with a short, deterministic, non-cryptographic hash
 * (cyrb53), so the version fits an HTTP header whatever the Node titles are. The server always
 * recomputes the Change impact, so a forged version gains nothing beyond a fresh preview.
 */
export function versionChangeImpact<Impact extends object>(impact: Impact) {
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
  return (
    titleCollator.compare(left.title, right.title) ||
    (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
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

export type ChangeWithImpact = 'hide' | 'delete' | 'dependency' | 'block' | 'unlock';

const staleChanges = {
  hide: ['NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  delete: ['NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
  dependency: ['DEPENDENCY_PREVIEW_STALE', 'de la dependencia'],
  block: ['TEACHER_BLOCK_PREVIEW_STALE', 'del bloqueo'],
  unlock: ['TEACHER_BLOCK_PREVIEW_STALE', 'del desbloqueo'],
} as const satisfies Record<ChangeWithImpact, readonly [string, string]>;

export type StaleChangeImpactReason = (typeof staleChanges)[ChangeWithImpact][0];

export function decideChangeImpactVersion({
  change,
  sentVersion,
  version,
}: {
  change: ChangeWithImpact;
  sentVersion: string | undefined;
  version: string;
}): { kind: 'ALLOWED' } | RuleRejection<StaleChangeImpactReason> {
  if (sentVersion === version) return { kind: 'ALLOWED' };
  const [reason, impact] = staleChanges[change];
  return ruleRejection(
    reason,
    `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
  );
}
