import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import type {
  AnyRoadmapDto,
  CourseOfferingIdentifier,
  DependencyImpact,
  NodeDeletionImpact,
  NodeHidingImpact,
  RoadmapDependencyRequest,
  StudentRoadmapDto,
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

/**
 * Everything the Roadmap canvas session reads and writes. Both adapters (HTTP and the
 * in-memory Practice roadmap) implement every operation. A previewed change sends the
 * version of the Change impact it confirms; a missing or changed version is rejected.
 */
export type RoadmapCanvasSessionPersistence = {
  load(input: RoadmapCanvasSessionInput): Promise<AnyRoadmapDto>;
  complete(input: RoadmapCanvasSessionInput, nodeId: string): Promise<void>;
  loadSimulation(input: RoadmapCanvasSessionInput): Promise<StudentRoadmapDto>;
  addNode(
    input: RoadmapCanvasSessionInput,
    node: NewRoadmapNode,
    position: Point,
  ): Promise<string | void>;
  updateNode(input: RoadmapCanvasSessionInput, nodeId: string, node: NodeUpdate): Promise<void>;
  moveNode(input: RoadmapCanvasSessionInput, nodeId: string, position: Point): Promise<void>;
  previewRoadmapDependency(
    input: RoadmapCanvasSessionInput,
    dependency: RoadmapDependencyRequest,
  ): Promise<DependencyImpact>;
  connectNodes(
    input: RoadmapCanvasSessionInput,
    dependency: RoadmapDependencyRequest,
    previewVersion: string,
  ): Promise<void>;
  deleteDependency(input: RoadmapCanvasSessionInput, dependencyId: string): Promise<void>;
  previewTeacherBlock(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    operation: TeacherBlockOperation,
  ): Promise<TeacherBlockPreview>;
  changeTeacherBlock(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    operation: TeacherBlockOperation,
    previewVersion?: string,
  ): Promise<void>;
  scheduleTeacherUnlock(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    unlockOn: string | null,
  ): Promise<void>;
  previewNodeHiding(input: RoadmapCanvasSessionInput, nodeId: string): Promise<NodeHidingImpact>;
  /**
   * Shows (`visible`) or hides the Node: the target visibility, never the current one.
   * Hiding sends the version of its previewed Change impact.
   */
  setVisibility(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    visible: boolean,
    previewVersion?: string,
  ): Promise<void>;
  previewNodeDeletion(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
  ): Promise<NodeDeletionImpact>;
  deleteNode(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    previewVersion: string,
  ): Promise<void>;
  addResource(
    input: RoadmapCanvasSessionInput,
    nodeId: string,
    resource: NewRoadmapResource,
  ): Promise<void>;
  uploadResource(input: RoadmapCanvasSessionInput, nodeId: string, file: File): Promise<void>;
  updateResource(
    input: RoadmapCanvasSessionInput,
    resourceId: string,
    resource: NewRoadmapResource,
  ): Promise<void>;
  deleteResource(input: RoadmapCanvasSessionInput, resourceId: string): Promise<void>;
  addNodeType(input: RoadmapCanvasSessionInput, nodeType: RoadmapNodeTypeInput): Promise<void>;
  updateNodeType(
    input: RoadmapCanvasSessionInput,
    nodeTypeId: string,
    nodeType: RoadmapNodeTypeInput,
  ): Promise<void>;
  deleteNodeType(input: RoadmapCanvasSessionInput, nodeTypeId: string): Promise<void>;
  completeSimulatedNode(input: RoadmapCanvasSessionInput, nodeId: string): Promise<void>;
  resetSimulation(input: RoadmapCanvasSessionInput): Promise<void>;
};

export type RoadmapCanvasExperience =
  | { readonly kind: 'student'; readonly term: 'current' | 'historical' }
  | { readonly kind: 'teaching'; readonly term: 'current' | 'historical' };

export type RoadmapCanvasSessionInput = {
  readonly notificationsEnabled?: boolean;
  readonly roadmapEntryKey?: string | null;
  readonly targetNodeId?: string;
  readonly courseOffering: {
    readonly identifier: CourseOfferingIdentifier;
    readonly title: string;
  };
  readonly experience: RoadmapCanvasExperience;
  /** Present on the Practice roadmap, which belongs to no Course offering. */
  readonly practice?: {
    /** Return destination for the exit control inside the Practice canvas. */
    readonly exitHref?: string;
    readonly nodeChangeCounts: Readonly<Record<string, number>>;
    /** Told about canvas actions that took effect, for the teaching Roadmap tutorial. */
    readonly onAction?: (action: PracticeCanvasAction) => void;
  };
};

/** A canvas action that took effect on the Practice roadmap. */
export type PracticeCanvasAction =
  | { readonly type: 'fitView' }
  | { readonly type: 'selectNode'; readonly nodeId: string }
  | { readonly type: 'addNode'; readonly nodeId: string }
  | { readonly type: 'connectNodes'; readonly sourceNodeId: string; readonly targetNodeId: string }
  | {
      readonly type: 'changeTeacherBlock';
      readonly nodeId: string;
      readonly operation: TeacherBlockOperation;
    }
  | { readonly type: 'changeVisibility'; readonly nodeId: string; readonly isVisible: boolean }
  | { readonly type: 'addResource'; readonly nodeId: string }
  | { readonly type: 'deleteNode'; readonly nodeId: string }
  | { readonly type: 'enterCanvasPreview' }
  | { readonly type: 'completeSimulatedNode'; readonly nodeId: string }
  | { readonly type: 'exitCanvasPreview' };
