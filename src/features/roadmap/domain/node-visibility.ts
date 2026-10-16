import type { RoadmapGraphDependency } from '@/features/roadmap/domain/access';

/**
 * What a Node's resulting visibility implies: a hidden Node has no Dependencies, no
 * Teacher block and no Scheduled unlock.
 */
export function decideVisibilityChange<Dependency extends RoadmapGraphDependency>({
  nodeId,
  isVisible,
  dependencies,
}: {
  nodeId: string;
  /** The Node's visibility after the change. */
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
