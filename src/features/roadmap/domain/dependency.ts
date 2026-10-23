import {
  dependencyTeacherBlockImpact,
  visibleRoadmapGraph,
  wouldCreateDependencyCycle,
  type RoadmapGraphDependency,
} from '@/features/roadmap/domain/access';
import { ruleRejection, type RuleRejection } from '@/features/roadmap/domain/rule-rejection';

type DependencyNode = {
  id: string;
  title: string;
  isVisible: boolean;
  isTeacherBlocked: boolean;
};

export type DependencyRuleFailure =
  | 'SELF_DEPENDENCY'
  | 'NODE_NOT_FOUND'
  | 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN'
  | 'DEPENDENCY_CONFLICT'
  | 'DEPENDENCY_CYCLE';

export type DependencyDecision =
  | { kind: 'ALLOWED'; teacherBlockedNodes: { id: string; title: string }[] }
  | RuleRejection<DependencyRuleFailure>;

export function decideDependency({
  nodes,
  dependencies,
  sourceNodeId,
  targetNodeId,
}: {
  nodes: readonly DependencyNode[];
  dependencies: readonly RoadmapGraphDependency[];
  sourceNodeId: string;
  targetNodeId: string;
}): DependencyDecision {
  if (sourceNodeId === targetNodeId)
    return ruleRejection('SELF_DEPENDENCY', 'Un nodo no puede depender de sí mismo.');
  const sourceNode = nodes.find(({ id }) => id === sourceNodeId);
  const targetNode = nodes.find(({ id }) => id === targetNodeId);
  if (!sourceNode || !targetNode)
    return ruleRejection('NODE_NOT_FOUND', 'El nodo no existe en este roadmap.');
  if (!sourceNode.isVisible || !targetNode.isVisible)
    return ruleRejection(
      'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
      'No se pueden crear dependencias con nodos ocultos.',
    );
  if (
    dependencies.some(
      (dependency) =>
        dependency.sourceNodeId === sourceNodeId && dependency.targetNodeId === targetNodeId,
    )
  )
    return ruleRejection('DEPENDENCY_CONFLICT', 'La dependencia ya existe.');
  if (wouldCreateDependencyCycle(dependencies, sourceNodeId, targetNodeId))
    return ruleRejection('DEPENDENCY_CYCLE', 'La dependencia formaría un ciclo.');
  if (!sourceNode.isTeacherBlocked) return { kind: 'ALLOWED', teacherBlockedNodes: [] };
  return {
    kind: 'ALLOWED',
    teacherBlockedNodes: dependencyTeacherBlockImpact(
      nodes,
      visibleRoadmapGraph(nodes, dependencies).dependencies,
      targetNodeId,
    ).sort((left, right) => left.title.localeCompare(right.title)),
  };
}
