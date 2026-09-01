export type RoadmapGraphDependency = {
  sourceNodeId: string;
  targetNodeId: string;
};

export type StudentNodeBlockReason = 'TEACHER_BLOCK' | 'PREREQUISITE_BLOCK';

export type StudentNodeAccess =
  { status: 'ACCESSIBLE' } | { status: 'BLOCKED'; reason: StudentNodeBlockReason };

type RoadmapAccessNode = {
  id: string;
  isTeacherBlocked: boolean;
};

function nodeIdsBySource(dependencies: readonly RoadmapGraphDependency[]) {
  const targetsBySource = new Map<string, string[]>();
  for (const { sourceNodeId, targetNodeId } of dependencies) {
    const targetNodeIds = targetsBySource.get(sourceNodeId) ?? [];
    targetNodeIds.push(targetNodeId);
    targetsBySource.set(sourceNodeId, targetNodeIds);
  }
  return targetsBySource;
}

function nodeIdsByTarget(dependencies: readonly RoadmapGraphDependency[]) {
  const sourceNodeIdsByTarget = new Map<string, string[]>();
  for (const { sourceNodeId, targetNodeId } of dependencies) {
    const sourceNodeIds = sourceNodeIdsByTarget.get(targetNodeId) ?? [];
    sourceNodeIds.push(sourceNodeId);
    sourceNodeIdsByTarget.set(targetNodeId, sourceNodeIds);
  }
  return sourceNodeIdsByTarget;
}

function transitiveNodeIds(startNodeId: string, adjacentNodeIdsByNodeId: Map<string, string[]>) {
  const visited = new Set([startNodeId]);
  const traversed = new Set<string>();
  const pending = [...(adjacentNodeIdsByNodeId.get(startNodeId) ?? [])];

  while (pending.length > 0) {
    const nodeId = pending.shift();
    if (!nodeId || visited.has(nodeId)) continue;
    visited.add(nodeId);
    traversed.add(nodeId);
    pending.push(...(adjacentNodeIdsByNodeId.get(nodeId) ?? []));
  }

  return traversed;
}

export function transitiveDependentNodeIds(
  dependencies: readonly RoadmapGraphDependency[],
  nodeId: string,
) {
  return transitiveNodeIds(nodeId, nodeIdsBySource(dependencies));
}

export function transitivePrerequisiteNodeIds(
  dependencies: readonly RoadmapGraphDependency[],
  nodeId: string,
) {
  return transitiveNodeIds(nodeId, nodeIdsByTarget(dependencies));
}

export function wouldCreateDependencyCycle(
  dependencies: readonly RoadmapGraphDependency[],
  sourceNodeId: string,
  targetNodeId: string,
) {
  return (
    sourceNodeId === targetNodeId ||
    transitiveDependentNodeIds(dependencies, targetNodeId).has(sourceNodeId)
  );
}

export function eligibleBranchUnlockNodeIds({
  dependencies,
  teacherBlockedNodeIds,
  rootNodeId,
}: {
  dependencies: readonly RoadmapGraphDependency[];
  teacherBlockedNodeIds: ReadonlySet<string>;
  rootNodeId: string;
}) {
  const branchNodeIds = new Set([
    rootNodeId,
    ...transitiveDependentNodeIds(dependencies, rootNodeId),
  ]);
  const prerequisiteNodeIdsByNodeId = nodeIdsByTarget(dependencies);
  const eligibilityByNodeId = new Map<string, boolean>();

  function isEligible(nodeId: string, visitingNodeIds = new Set<string>()): boolean {
    const cached = eligibilityByNodeId.get(nodeId);
    if (cached !== undefined) return cached;
    if (visitingNodeIds.has(nodeId)) return false;

    visitingNodeIds.add(nodeId);
    const isEligibleForUnlock = (prerequisiteNodeIdsByNodeId.get(nodeId) ?? []).every(
      (prerequisiteNodeId) =>
        !teacherBlockedNodeIds.has(prerequisiteNodeId) ||
        (branchNodeIds.has(prerequisiteNodeId) && isEligible(prerequisiteNodeId, visitingNodeIds)),
    );
    visitingNodeIds.delete(nodeId);
    eligibilityByNodeId.set(nodeId, isEligibleForUnlock);
    return isEligibleForUnlock;
  }

  return new Set(
    [...branchNodeIds].filter((nodeId) => teacherBlockedNodeIds.has(nodeId) && isEligible(nodeId)),
  );
}

export function studentNodeAccessById({
  nodes,
  dependencies,
  completedNodeIds,
}: {
  nodes: readonly RoadmapAccessNode[];
  dependencies: readonly RoadmapGraphDependency[];
  completedNodeIds: ReadonlySet<string>;
}) {
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const prerequisiteNodeIdsByNodeId = nodeIdsByTarget(dependencies);
  const accessByNodeId = new Map<string, StudentNodeAccess>();

  function accessFor(nodeId: string, visitingNodeIds = new Set<string>()): StudentNodeAccess {
    const cached = accessByNodeId.get(nodeId);
    if (cached) return cached;
    const node = nodesById.get(nodeId);
    if (!node) return { status: 'ACCESSIBLE' };
    if (node.isTeacherBlocked) {
      const access: StudentNodeAccess = { status: 'BLOCKED', reason: 'TEACHER_BLOCK' };
      accessByNodeId.set(nodeId, access);
      return access;
    }
    if (visitingNodeIds.has(nodeId)) return { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' };

    visitingNodeIds.add(nodeId);
    const prerequisiteBlocksAccess = (prerequisiteNodeIdsByNodeId.get(nodeId) ?? []).some(
      (prerequisiteNodeId) =>
        !completedNodeIds.has(prerequisiteNodeId) ||
        accessFor(prerequisiteNodeId, visitingNodeIds).status === 'BLOCKED',
    );
    visitingNodeIds.delete(nodeId);
    const access: StudentNodeAccess = prerequisiteBlocksAccess
      ? { status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' }
      : { status: 'ACCESSIBLE' };
    accessByNodeId.set(nodeId, access);
    return access;
  }

  for (const node of nodes) accessFor(node.id);
  return accessByNodeId;
}
