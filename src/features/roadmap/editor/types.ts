import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
  TeacherBlockOperation,
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

export type NodeEditorEffect =
  | { kind: 'update-node'; nodeId: string; value: NodeUpdate }
  | { kind: 'add-resource'; nodeId: string; resource: ResourceInput }
  | { kind: 'upload-resource'; nodeId: string; file: File }
  | { kind: 'update-resource'; resourceId: string; resource: ResourceInput }
  | { kind: 'delete-resource'; resourceId: string };

export type NodeEditorPerformResult = { status: 'committed' } | { status: 'rejected' };

export type NodeEditorCommand = {
  id: string;
  kind: 'open-resource';
  nodeId: string;
  mode: 'file' | 'link';
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
  | { kind: 'change-visibility'; nodeId: string; isVisible: boolean }
  | { kind: 'change-teacher-block'; nodeId: string; operation: TeacherBlockOperation }
  | { kind: 'delete-node'; nodeId: string };

export type NodeEditorProps = {
  node: RoadmapNode | undefined;
  nodeTypes: RoadmapDto['nodeTypes'];
  isVisibilityPending: boolean;
  command?: NodeEditorCommand;
  perform: (effect: NodeEditorEffect) => Promise<NodeEditorPerformResult>;
  onIntent: (intent: NodeEditorIntent) => void;
};

export type NodeEditorHandle = {
  guardDraft: (reason: NodeEditorGuardReason) => Promise<boolean>;
};

export type NodeTypeInput = { name: string; icon: NodeTypeIconId; color: NodeTypeColor };

export type NodeTypeDraft = {
  name: string;
  icon?: NodeTypeIconId;
  color?: NodeTypeColor;
};
