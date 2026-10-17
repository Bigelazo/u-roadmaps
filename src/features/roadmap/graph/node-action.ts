import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';

/** What the Node action menu asks for: canvas commands, plus opening the Resource composer. */
export type NodeActionIntent =
  | CanvasCommandOf<'hide-node' | 'show-node' | 'change-teacher-block' | 'delete-node'>
  | {
      readonly kind: 'add-resource';
      readonly nodeId: string;
    };

export type NodeActionCallbacks = {
  onAction?: (intent: NodeActionIntent) => void;
};
