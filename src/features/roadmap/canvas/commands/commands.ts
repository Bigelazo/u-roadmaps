import type { NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type { NewRoadmapNode, RoadmapNodeTypeInput } from '@/features/roadmap/session/types';
import type {
  DependencyImpact,
  NodeDeletionImpact,
  NodeHidingImpact,
  RoadmapDependencyRequest,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';

export type RoadmapNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type RoadmapNodePlacement = {
  readonly nodeId: string;
  readonly position: RoadmapNodePosition;
};

export type CanvasCommand =
  | { readonly kind: 'hide-node'; readonly nodeId: string }
  | { readonly kind: 'show-node'; readonly nodeId: string }
  | {
      readonly kind: 'change-teacher-block';
      readonly nodeId: string;
      readonly operation: TeacherBlockOperation;
    }
  | {
      readonly kind: 'schedule-teacher-unlock';
      readonly nodeId: string;
      readonly unlockOn: string | null;
    }
  | { readonly kind: 'delete-node'; readonly nodeId: string }
  | ({ readonly kind: 'create-dependency' } & RoadmapDependencyRequest)
  | { readonly kind: 'delete-dependencies'; readonly dependencyIds: readonly string[] }
  | { readonly kind: 'move-nodes'; readonly positions: readonly RoadmapNodePlacement[] }
  | {
      readonly kind: 'apply-automatic-layout';
      readonly positions: readonly RoadmapNodePlacement[];
      readonly direction: RoadmapLayoutDirection;
    }
  | { readonly kind: 'delete-node-type'; readonly nodeTypeId: string }
  | { readonly kind: 'reset-canvas-preview' }
  | {
      readonly kind: 'add-node';
      readonly node: NewRoadmapNode;
      readonly position: RoadmapNodePosition;
    }
  | { readonly kind: 'update-node'; readonly nodeId: string; readonly value: NodeUpdate }
  | { readonly kind: 'add-resource'; readonly nodeId: string; readonly resource: ResourceInput }
  | { readonly kind: 'upload-resource'; readonly nodeId: string; readonly file: File }
  | {
      readonly kind: 'update-resource';
      readonly resourceId: string;
      readonly resource: ResourceInput;
    }
  | { readonly kind: 'delete-resource'; readonly resourceId: string }
  | { readonly kind: 'add-node-type'; readonly nodeType: RoadmapNodeTypeInput }
  | {
      readonly kind: 'update-node-type';
      readonly nodeTypeId: string;
      readonly nodeType: RoadmapNodeTypeInput;
    }
  | { readonly kind: 'complete-node'; readonly nodeId: string }
  | { readonly kind: 'complete-simulated-node'; readonly nodeId: string };

export type CanvasCommandOf<Kind extends CanvasCommand['kind']> = Extract<
  CanvasCommand,
  { kind: Kind }
>;

export const canvasConfirmationChoices = {
  autoLayout: 'auto-layout',
  hideNode: 'hide-node',
  showNode: 'show-node',
  deleteNode: 'delete-node',
  deleteNodeType: 'delete-node-type',
  resetCanvasPreview: 'reset-canvas-preview',
  createDependency: 'create-dependency',
  deleteDependencies: 'delete-dependencies',
  blockTeacher: 'block-teacher',
  unlockNode: 'unlock-node',
  unlockBranch: 'unlock-branch',
  unlockPrerequisites: 'unlock-prerequisites',
} as const;

export type CanvasConfirmationChoice =
  (typeof canvasConfirmationChoices)[keyof typeof canvasConfirmationChoices];

export type TeacherBlockChangeImpact = {
  readonly [Operation in TeacherBlockOperation]?: TeacherBlockPreview;
};

export type ChangeImpactOf = {
  'hide-node': NodeHidingImpact;
  'show-node': null;
  'delete-node': NodeDeletionImpact;
  'change-teacher-block': TeacherBlockChangeImpact;
  'create-dependency': DependencyImpact;
  'delete-dependencies': null;
  'apply-automatic-layout': null;
  'delete-node-type': null;
  'reset-canvas-preview': null;
};

export type ConfirmedActionKind = keyof ChangeImpactOf;

export type UnconfirmedCommandKind = Exclude<CanvasCommand['kind'], ConfirmedActionKind>;

export type UnconfirmedCommand = CanvasCommandOf<UnconfirmedCommandKind>;

export type PendingConfirmation = {
  [Kind in ConfirmedActionKind]: {
    readonly kind: Kind;
    readonly request: CanvasCommandOf<Kind>;
    readonly impact: ChangeImpactOf[Kind] | null;
    readonly phase: 'reading-impact' | 'awaiting' | 'confirming';
    readonly choice?: CanvasConfirmationChoice;
  };
}[ConfirmedActionKind];
