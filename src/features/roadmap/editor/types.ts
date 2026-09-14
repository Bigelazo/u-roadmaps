import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { Dispatch, RefObject, SetStateAction } from 'react';
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

export type ResourceActionCallbacks = {
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUploadResource: (nodeId: string, file: File) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
};

export type ResourceEditorDraft = {
  value: ResourceInput;
  editingResourceId: string | null;
  isOpen: boolean;
  mode: 'file' | 'link';
  selectedFile: File | null;
};

export type RoadmapEditorDraft = {
  draftNodeId: string | null;
  editNode: NodeUpdate;
  resourceDraft: ResourceEditorDraft;
  isDirty: boolean;
  setEditNode: Dispatch<SetStateAction<NodeUpdate>>;
  setResourceDraft: Dispatch<SetStateAction<ResourceEditorDraft>>;
  reset: () => void;
};

export type RoadmapEditorDraftHandle = Pick<
  RoadmapEditorDraft,
  'draftNodeId' | 'isDirty' | 'reset'
>;

export type EditorDraftDiscardDestination =
  | { kind: 'discardNodeDraft'; nodeId: string }
  | { kind: 'discardResourceDraft'; nodeId: string }
  | { kind: 'discardCanvasPreviewDraft' };

export type NodeTypeInput = { name: string; icon: NodeTypeIconId; color: NodeTypeColor };

export type NodeTypeDraft = {
  name: string;
  icon?: NodeTypeIconId;
  color?: NodeTypeColor;
};

export type RoadmapEditorProps = ResourceActionCallbacks & {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
  isVisibilityPending: boolean;
  isOpen: boolean;
  resourceComposerRequest?: number;
  onClose: () => void;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onRequestTeacherBlock: (nodeId: string, operation: TeacherBlockOperation) => void;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onDeleteResource: (resourceId: string) => Promise<boolean>;
  onPreview: (node: StudentAccessibleRoadmapNode) => void;
  previewButtonRef: RefObject<HTMLButtonElement | null>;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
};
