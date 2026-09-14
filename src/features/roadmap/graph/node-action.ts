import type { TeacherBlockOperation } from '@/features/roadmap/types';

export type NodeAccessActionOperation = Extract<TeacherBlockOperation, 'BLOCK' | 'UNBLOCK'>;

export type NodeActionIntent =
  | {
      readonly kind: 'change-teacher-block';
      readonly nodeId: string;
      readonly operation: NodeAccessActionOperation;
    }
  | {
      readonly kind: 'change-visibility';
      readonly nodeId: string;
      readonly isVisible: boolean;
    }
  | {
      readonly kind: 'add-resource';
      readonly nodeId: string;
    }
  | {
      readonly kind: 'delete-node';
      readonly nodeId: string;
    };

export type NodeActionCallbacks = {
  onAction?: (intent: NodeActionIntent) => void;
};
