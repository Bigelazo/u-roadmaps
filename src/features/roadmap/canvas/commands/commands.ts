import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
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

/**
 * The canvas writes teaching staff can ask for, each named after the state it leads to.
 * The Graph and the Node editor emit subsets of it directly; no member carries the
 * current state, so no caller has to invert a flag.
 */
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
      /** Geometry is calculated in the Graph; confirmation and persistence belong to the canvas. */
      readonly kind: 'apply-automatic-layout';
      readonly positions: readonly RoadmapNodePlacement[];
      readonly direction: RoadmapLayoutDirection;
    }
  | { readonly kind: 'delete-node-type'; readonly nodeTypeId: string }
  | { readonly kind: 'reset-canvas-preview' };

export type CanvasCommandOf<Kind extends CanvasCommand['kind']> = Extract<
  CanvasCommand,
  { kind: Kind }
>;

/** The confirmation choices every Roadmap confirmation dialog can offer, by identifier. */
export const roadmapConfirmationActionIds = {
  autoLayout: 'auto-layout',
  hideNode: 'hide-node',
  showNode: 'show-node',
  deleteNode: 'delete-node',
  deleteResource: 'delete-resource',
  deleteNodeType: 'delete-node-type',
  resetCanvasPreview: 'reset-canvas-preview',
  createDependency: 'create-dependency',
  deleteDependencies: 'delete-dependencies',
  blockTeacher: 'block-teacher',
  unlockNode: 'unlock-node',
  unlockBranch: 'unlock-branch',
  unlockPrerequisites: 'unlock-prerequisites',
  discardEditorDraft: 'discard-draft',
} as const;

/**
 * The Teacher block previews a confirmation offers, by operation: blocking previews BLOCK
 * alone, and an unlock previews both scopes so teaching staff can unlock only the Node or
 * also its dependents.
 */
export type TeacherBlockChangeImpact = {
  readonly [Operation in TeacherBlockOperation]?: TeacherBlockPreview;
};

/** The Change impact each Confirmed action shows; `null` when it has none to preview. */
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

/** Canvas commands that take effect only after teaching staff confirm them. */
export type ConfirmedActionKind = keyof ChangeImpactOf;

/**
 * The single pending Confirmed action of a Roadmap canvas session, as plain data.
 * `previewing` reads its Change impact, `awaiting` waits for a choice and `confirming`
 * revalidates the impact and applies `choice`.
 */
export type PendingConfirmation = {
  [Kind in ConfirmedActionKind]: {
    readonly kind: Kind;
    readonly request: CanvasCommandOf<Kind>;
    readonly impact: ChangeImpactOf[Kind] | null;
    readonly phase: 'previewing' | 'awaiting' | 'confirming';
    readonly choice?: string;
  };
}[ConfirmedActionKind];
