import type { RoadmapGraphDependency } from '@/features/roadmap/domain/access';

export function decideVisibilityChange<Dependency extends RoadmapGraphDependency>({
  nodeId,
  isVisible,
  dependencies,
}: {
  nodeId: string;
  isVisible: boolean;
  dependencies: readonly Dependency[];
}) {
  return {
    removedDependencies: isVisible
      ? []
      : dependencies.filter(
          ({ sourceNodeId, targetNodeId }) => sourceNodeId === nodeId || targetNodeId === nodeId,
        ),
    clearsTeacherBlock: !isVisible,
  };
}
