import type {
  ChangeImpactCommand,
  CanvasCommand,
  ReadChangeImpactOf,
} from '@/features/roadmap/canvas/commands/commands';
import type { NodeTypeColor, NodeTypeIconId } from '@/features/roadmap/node-type-appearance';
import type {
  AnyRoadmapDto,
  CourseOfferingIdentifier,
  StudentRoadmapDto,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { ResourceInput } from '@/features/roadmap/editor/types';

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

export type ExecutionResult = { readonly createdNodeId?: string };

export type RoadmapCanvasSessionPersistence = {
  load(): Promise<AnyRoadmapDto>;
  loadCanvasPreview(): Promise<StudentRoadmapDto>;
  readChangeImpact<Command extends ChangeImpactCommand>(
    command: Command,
  ): Promise<ReadChangeImpactOf<Command['kind']>>;
  execute(command: CanvasCommand, previewVersion?: string): Promise<ExecutionResult | void>;
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
  readonly practice?: {
    readonly exitHref?: string;
    readonly nodeChangeCounts: Readonly<Record<string, number>>;
    readonly onAction?: (action: PracticeCanvasAction) => void;
  };
};

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
  | { readonly type: 'completeCanvasPreviewNode'; readonly nodeId: string }
  | { readonly type: 'exitCanvasPreview' };
