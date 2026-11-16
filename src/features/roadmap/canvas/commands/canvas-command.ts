import type { ChangeImpactOf as PlannedChangeImpactOf } from '@/features/roadmap/domain/change-impact';
import type { NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type { NewRoadmapNode, RoadmapNodeTypeInput } from '@/features/roadmap/session/types';
import type { RoadmapDependencyRequest, TeacherBlockOperation } from '@/features/roadmap/types';

export type RoadmapNodePosition = {
  readonly x: number;
  readonly y: number;
};

export type RoadmapNodePlacement = {
  readonly nodeId: string;
  readonly position: RoadmapNodePosition;
};

export type NewNodePlacement = {
  readonly position: RoadmapNodePosition;
  readonly displaced: readonly RoadmapNodePlacement[];
};

export type TeacherBlockSchedule = {
  readonly unlockAt: string;
};

export type AutomaticLayouts = Readonly<
  Record<RoadmapLayoutDirection, readonly RoadmapNodePlacement[]>
>;

type CanvasCommandPayloads = {
  'hide-node': { nodeId: string };
  'show-node': { nodeId: string };
  'delete-node': { nodeId: string };
  'change-teacher-block': {
    nodeId: string;
    operation: TeacherBlockOperation;
    schedule?: TeacherBlockSchedule;
  };
  'schedule-teacher-unlock': {
    nodeId: string;
    unlockAt: string | null;
    includeDependents?: boolean;
  };
  'create-dependency': RoadmapDependencyRequest;
  'delete-dependencies': { dependencyIds: readonly string[] };
  'move-nodes': { positions: readonly RoadmapNodePlacement[] };
  'apply-automatic-layout': { layouts: AutomaticLayouts; direction?: RoadmapLayoutDirection };
  'add-node': { nodeId: string; node: NewRoadmapNode } & NewNodePlacement;
  'update-node': { nodeId: string; value: NodeUpdate };
  'add-resource': { nodeId: string; resource: ResourceInput };
  'upload-resource': { nodeId: string; file: File };
  'update-resource': { resourceId: string; resource: ResourceInput; file?: File };
  'delete-resource': { resourceId: string };
  'add-node-type': { nodeType: RoadmapNodeTypeInput };
  'update-node-type': { nodeTypeId: string; nodeType: RoadmapNodeTypeInput };
  'delete-node-type': { nodeTypeId: string };
  'complete-node': { nodeId: string };
  'complete-canvas-preview-node': { nodeId: string };
  'reset-canvas-preview': object;
};

export type CanvasCommandKind = keyof CanvasCommandPayloads;

export type CanvasCommandOf<Kind extends CanvasCommandKind> = {
  [Each in Kind]: Readonly<{ kind: Each } & CanvasCommandPayloads[Each]>;
}[Kind];

export type CanvasCommand = CanvasCommandOf<CanvasCommandKind>;

export type ChangeImpactCommand = CanvasCommandOf<keyof PlannedChangeImpactOf>;

export type ReadChangeImpactOf<Kind extends keyof PlannedChangeImpactOf> =
  PlannedChangeImpactOf[Kind];

export type ScheduledUnlock = {
  readonly nodeId: string;
  readonly unlockAt: string | null;
  readonly includeDependents?: boolean;
};

export const teacherBlockScheduledUnlock = (
  nodeId: string,
  operation: TeacherBlockOperation,
  { unlockAt }: TeacherBlockSchedule,
): ScheduledUnlock => ({
  nodeId,
  unlockAt,
  includeDependents: operation === 'BRANCH_UNLOCK',
});

export const chosenAutomaticLayout = ({
  layouts,
  direction = 'TB',
}: {
  readonly layouts: AutomaticLayouts;
  readonly direction?: RoadmapLayoutDirection;
}) => layouts[direction];
