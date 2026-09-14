import type { TeacherBlockOperation } from '@/features/roadmap/types';

export type NodeAccessActionOperation = Extract<TeacherBlockOperation, 'BLOCK' | 'UNBLOCK'>;

export type NodeActionCallbacks = {
  onRequestAccessAction?: (nodeId: string, operation: NodeAccessActionOperation) => void;
  onRequestVisibilityAction?: (nodeId: string, isVisible: boolean) => void;
  onRequestAddResource?: (nodeId: string) => void;
  onRequestDelete?: (nodeId: string) => void;
};
