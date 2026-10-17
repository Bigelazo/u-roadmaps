import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type { RoadmapDependencyRequest, TeacherBlockOperation } from '@/features/roadmap/types';

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
    };

export type CanvasCommandOf<Kind extends CanvasCommand['kind']> = Extract<
  CanvasCommand,
  { kind: Kind }
>;
