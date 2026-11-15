import {
  chosenAutomaticLayout,
  teacherBlockScheduledUnlock,
  type CanvasCommand,
  type CanvasCommandKind,
  type CanvasCommandOf,
  type RoadmapNodePlacement,
  type ScheduledUnlock,
} from '@/features/roadmap/canvas/commands/canvas-command';
import type { ChangeWithImpact } from '@/features/roadmap/domain/change-impact';
import type { NodeTypeChange } from '@/features/roadmap/domain/node-type';
import {
  fileReplacementError,
  linkResourceOnlyError,
  resourceEditError,
  uploadedContentType,
} from '@/features/roadmap/domain/resource';
import {
  blockedPrerequisiteNodeIds,
  decideScheduledUnlock,
} from '@/features/roadmap/domain/scheduled-unlock';
import type { Point } from '@/features/roadmap/graph/geometry';
import { nodesDisplacedByNewNode } from '@/features/roadmap/graph/node-collisions';
import type { ExecutionResult } from '@/features/roadmap/session/types';
import type { AnyRoadmapDto, Resource, RoadmapNode } from '@/features/roadmap/types';

type AnyRoadmapNode = AnyRoadmapDto['nodes'][number];
type NodeDraft = { readonly id: string };

export type SimulatedProgress = {
  readonly completedNodeIds: Set<string>;
  readonly reviewedResourceIds: Set<string>;
};

export type PracticeRoadmap = {
  roadmap: AnyRoadmapDto;
  readonly canvasPreviewProgress: SimulatedProgress;
  readonly createdNodePosition?: Point;
  complete(nodeId: string): void;
  completeCanvasPreview(nodeId: string): void;
  resetCanvasPreview(): void;
  updateNodes(update: (nodes: AnyRoadmapNode[]) => readonly NodeDraft[]): void;
  mutateNode(nodeId: string, update: (node: AnyRoadmapNode) => NodeDraft): void;
  mutateResource(resourceId: string, update: (resource: Resource) => Resource | null): void;
  appendResource(nodeId: string, resource: Resource): void;
  confirm(
    change: ChangeWithImpact,
    previewVersion?: string,
  ): { readonly blockedNodeIds: readonly string[] };
  requireAvailableNodeType(nodeTypeId: string): void;
  decideNodeType(change: NodeTypeChange): void;
  settleEach<Item>(items: readonly Item[], apply: (item: Item) => void): void;
};

type PracticeCommand<Command> = {
  apply(
    practice: PracticeRoadmap,
    command: Command,
    previewVersion?: string,
  ): ExecutionResult | void;
}['apply'];

export type AnyPracticeCommand = PracticeCommand<CanvasCommand>;

const scheduleUnlock = (
  practice: PracticeRoadmap,
  { nodeId, unlockAt, includeDependents }: ScheduledUnlock,
): ExecutionResult => {
  const nodes = practice.roadmap.nodes.filter(
    (node): node is RoadmapNode => 'isTeacherBlocked' in node,
  );
  const node = nodes.find(({ id }) => id === nodeId);
  if (!node) return {};
  const decision = decideScheduledUnlock({ node, unlockAt, includeDependents, now: new Date() });
  if (decision.kind === 'REJECTED') throw new Error(decision.message);
  const prerequisiteIds = decision.unlockAt
    ? blockedPrerequisiteNodeIds({ nodes, dependencies: practice.roadmap.dependencies, nodeId })
    : [];
  const schedules = new Map([
    [nodeId, { unlockAt: decision.unlockAt, includesDependents: decision.includesDependents }],
    ...prerequisiteIds.map(
      (id) => [id, { unlockAt: decision.unlockAt, includesDependents: false }] as const,
    ),
  ]);
  practice.updateNodes((current) =>
    current.map((candidate) => {
      const schedule = schedules.get(candidate.id);
      return schedule && 'isTeacherBlocked' in candidate
        ? {
            ...candidate,
            teacherUnlockAt: schedule.unlockAt ?? undefined,
            teacherUnlockIncludesDependents: schedule.includesDependents || undefined,
          }
        : candidate;
    }),
  );
  return { scheduledUnlock: { title: node.title, prerequisites: prerequisiteIds.length } };
};

const moveNodes = (practice: PracticeRoadmap, positions: readonly RoadmapNodePlacement[]) =>
  practice.settleEach(positions, ({ nodeId, position }) =>
    practice.mutateNode(nodeId, (node) => ({
      ...node,
      positionX: position.x,
      positionY: position.y,
    })),
  );

const setVisibility = (practice: PracticeRoadmap, nodeId: string, isVisible: boolean) =>
  practice.mutateNode(nodeId, (node) => ('isVisible' in node ? { ...node, isVisible } : node));

export const practiceCommands: {
  [Kind in CanvasCommandKind]: PracticeCommand<CanvasCommandOf<Kind>>;
} = {
  'hide-node': (practice, command, previewVersion) => {
    practice.confirm(command, previewVersion);
    setVisibility(practice, command.nodeId, false);
  },
  'show-node': (practice, { nodeId }) => setVisibility(practice, nodeId, true),
  'delete-node': (practice, command, previewVersion) => {
    practice.confirm(command, previewVersion);
    practice.updateNodes((nodes) => nodes.filter(({ id }) => id !== command.nodeId));
  },
  'change-teacher-block': (practice, command, previewVersion) =>
    command.schedule
      ? void scheduleUnlock(
          practice,
          teacherBlockScheduledUnlock(command.nodeId, command.operation, command.schedule),
        )
      : void practice.confirm(command, previewVersion),
  'schedule-teacher-unlock': scheduleUnlock,
  'create-dependency': (practice, command, previewVersion) => {
    const { blockedNodeIds } = practice.confirm(command, previewVersion);
    const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = command;
    const dependency = {
      id: crypto.randomUUID(),
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      targetHandle,
    };
    practice.roadmap = {
      ...practice.roadmap,
      dependencies: [...practice.roadmap.dependencies, dependency],
    };
    return { dependency, teacherBlockedNodeIds: blockedNodeIds };
  },
  'delete-dependencies': (practice, { dependencyIds }) => {
    const removed = new Set(dependencyIds);
    practice.roadmap = {
      ...practice.roadmap,
      dependencies: practice.roadmap.dependencies.filter(({ id }) => !removed.has(id)),
    };
  },
  'move-nodes': (practice, { positions }) => moveNodes(practice, positions),
  'apply-automatic-layout': (practice, layout) =>
    moveNodes(practice, chosenAutomaticLayout(layout)),
  'add-node': (practice, { node, position: requested }) => {
    practice.requireAvailableNodeType(node.nodeTypeId);
    const id = crypto.randomUUID();
    const position = practice.createdNodePosition ?? requested;
    moveNodes(
      practice,
      nodesDisplacedByNewNode(
        practice.roadmap.nodes.map(({ id, title, positionX, positionY }) => ({
          id,
          title,
          position: { x: positionX, y: positionY },
        })),
        { id, title: node.title, position },
      ),
    );
    practice.updateNodes((nodes) => [
      ...nodes,
      {
        id,
        title: node.title,
        description: node.description || null,
        nodeTypeId: node.nodeTypeId,
        positionX: position.x,
        positionY: position.y,
        isVisible: node.isVisible,
        isTeacherBlocked: false,
        resources: [],
      },
    ]);
    return { createdNodeId: id };
  },
  'update-node': (practice, { nodeId, value }) => {
    practice.requireAvailableNodeType(value.nodeTypeId);
    practice.mutateNode(nodeId, (node) => ({
      ...node,
      title: value.title,
      description: value.description || null,
      nodeTypeId: value.nodeTypeId,
    }));
  },
  'add-resource': (practice, { nodeId, resource }) => {
    const error = linkResourceOnlyError(resource.type);
    if (error) throw new Error(error);
    practice.appendResource(nodeId, {
      ...resource,
      id: crypto.randomUUID(),
      fileContentType: null,
      fileSize: null,
      accessCount: 0,
    });
  },
  'upload-resource': (practice, { nodeId, file }) =>
    practice.appendResource(nodeId, {
      id: crypto.randomUUID(),
      title: file.name,
      url: file.name,
      type: 'FILE',
      fileContentType: uploadedContentType(file),
      fileSize: file.size,
      accessCount: 0,
    }),
  'update-resource': (practice, { resourceId, resource, file }) =>
    practice.mutateResource(resourceId, (current) => {
      if (file) {
        const error = fileReplacementError(current.type);
        if (error) throw new Error(error);
        practice.canvasPreviewProgress.reviewedResourceIds.delete(resourceId);
        return {
          ...current,
          title: resource.title,
          url: file.name,
          fileContentType: uploadedContentType(file),
          fileSize: file.size,
        };
      }
      const changes =
        current.type === 'FILE' && resource.type === 'FILE' && resource.url === current.url
          ? { title: resource.title }
          : resource;
      const error = resourceEditError(current.type, changes);
      if (error) throw new Error(error);
      return { ...current, ...changes };
    }),
  'delete-resource': (practice, { resourceId }) => practice.mutateResource(resourceId, () => null),
  'add-node-type': (practice, { nodeType }) => {
    practice.decideNodeType({ kind: 'create', name: nodeType.name });
    practice.roadmap = {
      ...practice.roadmap,
      nodeTypes: [
        ...practice.roadmap.nodeTypes,
        { ...nodeType, id: crypto.randomUUID(), isPredefined: false },
      ],
    };
  },
  'update-node-type': (practice, { nodeTypeId, nodeType }) => {
    practice.decideNodeType({ kind: 'update', nodeTypeId, name: nodeType.name });
    practice.roadmap = {
      ...practice.roadmap,
      nodeTypes: practice.roadmap.nodeTypes.map((current) =>
        current.id === nodeTypeId ? { ...current, ...nodeType } : current,
      ),
    };
  },
  'delete-node-type': (practice, { nodeTypeId }) => {
    practice.decideNodeType({ kind: 'delete', nodeTypeId });
    practice.roadmap = {
      ...practice.roadmap,
      nodeTypes: practice.roadmap.nodeTypes.filter(({ id }) => id !== nodeTypeId),
    };
  },
  'complete-node': (practice, { nodeId }) => practice.complete(nodeId),
  'complete-canvas-preview-node': (practice, { nodeId }) => practice.completeCanvasPreview(nodeId),
  'reset-canvas-preview': (practice) => practice.resetCanvasPreview(),
};
