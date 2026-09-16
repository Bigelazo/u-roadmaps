import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import type {
  AnyRoadmapDto,
  CourseOfferingIdentifier,
  NodeDeletionImpact,
  StudentRoadmapDto,
  TeacherBlockImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';

export type NewRoadmapNode = {
  title: string;
  description: string;
  nodeTypeId: string;
  isVisible: boolean;
};

export type NewRoadmapResource = ResourceInput;
export type RoadmapNodeTypeInput = {
  name: string;
  icon: NodeTypeIconId;
  color: NodeTypeColor;
};

export type RoadmapCanvasSessionPersistence = {
  load(input: RoadmapCanvasSessionInput): Promise<AnyRoadmapDto>;
  complete(input: RoadmapCanvasSessionInput, nodeId: string): Promise<void>;
  loadSimulation?(input: RoadmapCanvasSessionInput): Promise<StudentRoadmapDto>;
  addNode?(
    input: RoadmapCanvasSessionInput,
    node: NewRoadmapNode,
    position: Point,
  ): Promise<string | void>;
  updateNode?(input: RoadmapCanvasSessionInput, nodeId: string, node: NodeUpdate): Promise<void>;
  moveNode?(input: RoadmapCanvasSessionInput, nodeId: string, position: Point): Promise<void>;
  connectNodes?(
    input: RoadmapCanvasSessionInput,
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ): Promise<void>;
  previewRoadmapDependency?(
    input: RoadmapCanvasSessionInput,
    sourceNodeId: string,
    targetNodeId: string,
    sourceHandle?: string,
    targetHandle?: string,
  ): Promise<TeacherBlockImpact[]>;
  previewTeacherBlock?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    operation: TeacherBlockOperation,
  ): Promise<TeacherBlockPreview>;
  changeTeacherBlock?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    operation: TeacherBlockOperation,
    previewVersion?: string,
  ): Promise<void>;
  deleteDependency?(input: RoadmapCanvasSessionInput, dependencyId: string): Promise<void>;
  toggleVisibility?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    isVisible: boolean,
  ): Promise<void>;
  previewNodeVisibility?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
  ): Promise<{ id: string; sourceNodeId: string; targetNodeId: string }[]>;
  previewNodeDeletion?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
  ): Promise<NodeDeletionImpact>;
  deleteNode?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    previewVersion?: string,
  ): Promise<void>;
  addResource?(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    resource: NewRoadmapResource,
  ): Promise<void>;
  uploadResource?(input: RoadmapCanvasSessionInput, nodeId: string, file: File): Promise<void>;
  updateResource?(
    input: RoadmapCanvasSessionInput,
    resourceId: string,
    resource: NewRoadmapResource,
  ): Promise<void>;
  deleteResource?(input: RoadmapCanvasSessionInput, resourceId: string): Promise<void>;
  addNodeType?(input: RoadmapCanvasSessionInput, nodeType: RoadmapNodeTypeInput): Promise<void>;
  updateNodeType?(
    input: RoadmapCanvasSessionInput,
    nodeTypeId: string,
    nodeType: RoadmapNodeTypeInput,
  ): Promise<void>;
  deleteNodeType?(input: RoadmapCanvasSessionInput, nodeTypeId: string): Promise<void>;
  completeSimulatedNode?(input: RoadmapCanvasSessionInput, nodeId: string): Promise<void>;
  resetSimulation?(input: RoadmapCanvasSessionInput): Promise<void>;
};

export type RoadmapCanvasExperience =
  | { readonly kind: 'student'; readonly term: 'current' | 'historical' }
  | { readonly kind: 'teaching'; readonly term: 'current' | 'historical' };

export type RoadmapCanvasSessionInput = {
  readonly courseOffering: {
    readonly identifier: CourseOfferingIdentifier;
    readonly title: string;
  };
  readonly experience: RoadmapCanvasExperience;
};
