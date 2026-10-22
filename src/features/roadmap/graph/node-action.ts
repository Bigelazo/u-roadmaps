import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';

export type NodeActionIntent =
  | CanvasCommandOf<'hide-node' | 'show-node' | 'change-teacher-block' | 'delete-node'>
  | {
      readonly kind: 'add-resource';
      readonly nodeId: string;
    };

export type NodeActionCallbacks = {
  onAction?: (intent: NodeActionIntent) => void;
};
