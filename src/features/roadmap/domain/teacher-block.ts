import type {
  TeacherBlockImpact,
  TeacherBlockOperation,
  TeacherBlockUnlockMode,
} from '@/features/roadmap/types';
import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';
import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

type TeacherBlockNode = {
  id: string;
  title: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
  nodeType?: TeacherBlockImpact['nodeType'];
};

export type TeacherBlockRuleFailure = 'NODE_NOT_FOUND' | 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN';

export type TeacherBlockDecision =
  | {
      kind: 'ALLOWED';
      mode: TeacherBlockUnlockMode;
      nodes: TeacherBlockImpact[];
    }
  | RuleRejection<TeacherBlockRuleFailure>;

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
  if (!selectedNode) return ruleRejection('NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  if (!selectedNode.isVisible)
    return ruleRejection(
      'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
      'Un nodo oculto no puede tener un bloqueo docente.',
    );

  let changedNodeIds: Set<string>;
  let mode: TeacherBlockUnlockMode;
  if (operation === 'BLOCK') {
    mode = 'BLOCK';
    changedNodeIds = new Set(
      [nodeId, ...transitiveDependentNodeIds(dependencies, nodeId)].filter((candidateNodeId) => {
        const node = nodeById.get(candidateNodeId);
        return node?.isVisible && !node.isTeacherBlocked;
      }),
    );
  } else {
    const prerequisiteNodeIds = transitivePrerequisiteNodeIds(dependencies, nodeId);
    const hasTeacherBlockedPrerequisite = [...prerequisiteNodeIds].some(
      (prerequisiteNodeId) => nodeById.get(prerequisiteNodeId)?.isTeacherBlocked,
    );
    if (hasTeacherBlockedPrerequisite) {
      mode = 'UPSTREAM';
      changedNodeIds = new Set(
        [nodeId, ...prerequisiteNodeIds].filter(
          (candidateNodeId) => nodeById.get(candidateNodeId)?.isTeacherBlocked,
        ),
      );
    } else if (operation === 'UNBLOCK') {
      mode = 'SINGLE';
      changedNodeIds = selectedNode.isTeacherBlocked ? new Set([nodeId]) : new Set();
    } else {
      mode = 'BRANCH';
      changedNodeIds = eligibleBranchUnlockNodeIds({
        dependencies,
        teacherBlockedNodeIds: nodes.reduce<Set<string>>((ids, node) => {
          if (node.isTeacherBlocked) ids.add(node.id);
          return ids;
        }, new Set()),
        rootNodeId: nodeId,
      });
    }
  }

  return {
    kind: 'ALLOWED',
    mode,
    nodes: nodes.reduce<TeacherBlockImpact[]>((affectedNodes, node) => {
      if (!changedNodeIds.has(node.id)) return affectedNodes;
      const { id, title, nodeType } = node;
      affectedNodes.push({
        id,
        title,
        ...(nodeType ? { nodeType } : {}),
        relation:
          id === nodeId ? 'SELECTED_NODE' : mode === 'UPSTREAM' ? 'PREREQUISITE' : 'DEPENDENT',
      });
      return affectedNodes;
    }, []),
  };
}
