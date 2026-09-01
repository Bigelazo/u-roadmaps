import type {
  RoadmapNode,
  StudentBlockedRoadmapNode,
  StudentRoadmapNode,
} from '@/lib/roadmap-types';
import type { StudentNodeBlockReason } from '@/lib/roadmap-access';

export type StudentNodeStatus = 'completed' | 'available' | 'locked';

export const studentNodeBlockMessages: Record<StudentNodeBlockReason, string> = {
  TEACHER_BLOCK: 'Bloqueado por el equipo docente',
  PREREQUISITE_BLOCK: 'Completa los prerrequisitos',
};

export type StudentNode = RoadmapNode | StudentRoadmapNode;

export function isStudentBlockedNode(
  node: StudentNode | undefined,
): node is StudentBlockedRoadmapNode {
  return Boolean(node && 'access' in node && node.access.status === 'BLOCKED');
}

export function studentNodeBlockReason(node: StudentNode): StudentNodeBlockReason | undefined {
  return isStudentBlockedNode(node) ? node.access.reason : undefined;
}

export function studentNodeStatus(node: StudentNode): StudentNodeStatus {
  if (isStudentBlockedNode(node)) return 'locked';
  if ('isCompleted' in node && node.isCompleted) return 'completed';
  return 'canComplete' in node && node.canComplete ? 'available' : 'locked';
}
