import type { NodeAccessState } from '@/shared/node-access';

/** Apply broad targets before reconciling independent Node and Resource targets. */
export function reconcileAbsorption({
  roadmapAvailable,
  newNode,
  nodeState,
}: {
  roadmapAvailable: boolean;
  newNode: boolean;
  nodeState: NodeAccessState | 'deleted' | null;
}): 'availability' | 'creation' | 'withdraw' | 'deletion' | 'independent' {
  if (roadmapAvailable) return 'availability';
  if (newNode) return nodeState === 'Retirado' || nodeState === 'deleted' ? 'withdraw' : 'creation';
  if (nodeState === 'deleted') return 'deletion';
  return 'independent';
}
