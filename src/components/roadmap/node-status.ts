import type { RoadmapNode } from '@/lib/roadmap-types';

export type StudentNodeStatus = 'completed' | 'available' | 'locked';

export function studentNodeStatus(node: RoadmapNode): StudentNodeStatus {
  if (node.isCompleted) return 'completed';
  return node.canComplete ? 'available' : 'locked';
}
