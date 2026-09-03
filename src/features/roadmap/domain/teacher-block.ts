import type { TeacherBlockOperation } from '@/features/roadmap/types';
import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';

type TeacherBlockNode = {
  id: string;
  title: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
};

export type TeacherBlockRuleFailure =
  | 'NODE_NOT_FOUND'
  | 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN'
  | 'TEACHER_BLOCKED_PREREQUISITE';

export type TeacherBlockDecision =
  | { kind: 'ALLOWED'; nodes: Array<{ id: string; title: string }> }
  | { kind: 'REJECTED'; reason: TeacherBlockRuleFailure };

export function decideTeacherBlock({
  nodes,
  dependencies,
  nodeId,
  operation,
}: {
  nodes: readonly TeacherBlockNode[];
  dependencies: readonly RoadmapGraphDependency[];
  nodeId: string;
  operation: TeacherBlockOperation;
}): TeacherBlockDecision {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const selectedNode = nodeById.get(nodeId);
  if (!selectedNode) return { kind: 'REJECTED', reason: 'NODE_NOT_FOUND' };
  if (!selectedNode.isVisible) {
    return { kind: 'REJECTED', reason: 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN' };
  }

  let changedNodeIds: Set<string>;
  if (operation === 'BLOCK') {
    changedNodeIds = new Set(
      [nodeId, ...transitiveDependentNodeIds(dependencies, nodeId)].filter((candidateNodeId) => {
        const node = nodeById.get(candidateNodeId);
        return node?.isVisible && !node.isTeacherBlocked;
      }),
    );
  } else if (operation === 'UNBLOCK') {
    if (!selectedNode.isTeacherBlocked) return { kind: 'ALLOWED', nodes: [] };
    const hasTeacherBlockedPrerequisite = [
      ...transitivePrerequisiteNodeIds(dependencies, nodeId),
    ].some((prerequisiteNodeId) => nodeById.get(prerequisiteNodeId)?.isTeacherBlocked);
    if (hasTeacherBlockedPrerequisite) {
      return { kind: 'REJECTED', reason: 'TEACHER_BLOCKED_PREREQUISITE' };
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
    kind: 'ALLOWED',
    nodes: nodes
      .filter((node) => changedNodeIds.has(node.id))
      .map(({ id, title }) => ({ id, title })),
  };
}
