import type { CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';
import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
} from '@/features/roadmap/types';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';

export type NodeInput = {
  title: string;
  description: string;
  nodeTypeId: string;
  isVisible: boolean;
};

export type NodeUpdate = Omit<NodeInput, 'isVisible'>;

export type ResourceInput = {
  title: string;
  url: string;
  type: Resource['type'];
};

export type ResourceSession =
  | { kind: 'closed' }
  | { kind: 'adding-file'; value: ResourceInput; selectedFile: File | null }
  | { kind: 'adding-link'; value: ResourceInput }
  | { kind: 'editing-existing'; resourceId: string; value: ResourceInput };

export type NodeEditorEffect = CanvasCommandOf<
  'update-node' | 'add-resource' | 'upload-resource' | 'update-resource' | 'delete-resource'
>;

export type NodeEditorPerformResult = { status: 'committed' } | { status: 'rejected' };

export type NodeEditorEffectChannel = (
  effect: NodeEditorEffect,
) => Promise<NodeEditorPerformResult>;

export type NodeEditorIntentChannel = (intent: NodeEditorIntent) => void;

export type NodeEditorCommand = {
  id: string;
  kind: 'open-resource';
  nodeId: string;
  mode: 'file' | 'link';
  value?: ResourceInput;
};

export type NodeEditorGuardReason =
  | { kind: 'replace-node'; nodeId: string }
  | { kind: 'deselect-node'; nodeId: string }
  | { kind: 'delete-node'; nodeId: string }
  | { kind: 'open-resource'; nodeId: string }
  | { kind: 'enter-canvas-preview' };

export type NodeEditorIntent =
  | { kind: 'close'; nodeId: string }
  | {
      kind: 'preview-node-information';
      node: StudentAccessibleRoadmapNode;
      returnFocus: () => void;
    }
  | CanvasCommandOf<
      'hide-node' | 'show-node' | 'change-teacher-block' | 'schedule-teacher-unlock' | 'delete-node'
    >;

export type NodeEditorSession = {
  node: RoadmapNode | undefined;
  nodeTypes: RoadmapDto['nodeTypes'];
  isVisibilityPending: boolean;
};

export type NodeEditorProps = {
  session: NodeEditorSession;
  command?: NodeEditorCommand;
  perform: NodeEditorEffectChannel;
  onIntent: NodeEditorIntentChannel;
};

export type NodeEditorHandle = {
  hasDraft?: () => boolean;
  guardDraft: (reason: NodeEditorGuardReason) => Promise<boolean>;
};

export type NodeTypeInput = { name: string; icon: NodeTypeIconId; color: NodeTypeColor };

export type NodeTypeDraft = {
  name: string;
  icon?: NodeTypeIconId;
  color?: NodeTypeColor;
};

export const NODE_TYPES_MENU_ITEM_LABEL = 'Gestionar tipos de nodo';
