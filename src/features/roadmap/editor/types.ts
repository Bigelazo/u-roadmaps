import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';

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

export type NodeTypeInput = { name: string; color: string };

export type RoadmapEditorProps = {
  roadmap: RoadmapDto;
  selectedNode: RoadmapNode | undefined;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onUpdateNode: (nodeId: string, node: NodeUpdate) => Promise<boolean>;
  onToggleVisibility: (nodeId: string, isVisible: boolean) => Promise<boolean>;
  onDeleteNode: (nodeId: string) => Promise<boolean>;
  onAddResource: (nodeId: string, resource: ResourceInput) => Promise<boolean>;
  onUpdateResource: (resourceId: string, resource: ResourceInput) => Promise<boolean>;
  onDeleteResource: (resourceId: string) => Promise<boolean>;
  onAddNodeType: (nodeType: NodeTypeInput) => Promise<boolean>;
  onUpdateNodeType: (nodeTypeId: string, nodeType: NodeTypeInput) => Promise<boolean>;
  onDeleteNodeType: (nodeTypeId: string) => Promise<boolean>;
};
