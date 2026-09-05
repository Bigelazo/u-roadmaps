import type {
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { RefObject } from 'react';
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

export type NodeTypeInput = { name: string; icon: NodeTypeIconId; color: NodeTypeColor };

export type NodeTypeDraft = {
  name: string;
  icon?: NodeTypeIconId;
  color?: NodeTypeColor;
};

export type RoadmapEditorProps = {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
  isOpen: boolean;
  onClose: () => void;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onRequestTeacherBlock: (nodeId: string, operation: TeacherBlockOperation) => void;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUploadResource: (nodeId: string, file: File) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onDeleteResource: (resourceId: string) => Promise<boolean>;
  onPreview: (node: StudentAccessibleRoadmapNode) => void;
  onDirtyChange?: (isDirty: boolean) => void;
  previewButtonRef: RefObject<HTMLButtonElement | null>;
  panelWidth: number;
  onPanelWidthChange: (width: number) => void;
};
