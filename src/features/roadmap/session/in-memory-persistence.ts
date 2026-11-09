import type { Point } from '@/features/roadmap/graph/geometry';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import {
  hasUnreviewedResources,
  unreviewedResourcesMessage,
} from '@/features/roadmap/domain/resource-review';
import {
  confirmChange,
  planChange,
  type ChangeWithImpact,
  type RoadmapSnapshot,
} from '@/features/roadmap/domain/change-impact';
import { studentRoadmapNodes } from '@/features/roadmap/domain/participant-view';
import {
  decideNodeTypeAssignment,
  decideNodeTypeChange,
  type NodeTypeChange,
} from '@/features/roadmap/domain/node-type';
import type {
  AnyRoadmapDto,
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
} from '@/features/roadmap/types';
import {
  canvasCommandCatalog,
  type AnyCommandEntry,
} from '@/features/roadmap/canvas/commands/commands';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

function copy<T>(value: T): T {
  return structuredClone(value);
}

type AnyRoadmapNode = AnyRoadmapDto['nodes'][number];
type NodeDraft = { readonly id: string };

type SimulatedProgress = {
  readonly completedNodeIds: Set<string>;
  readonly reviewedResourceIds: Set<string>;
};

function asStudentRoadmap(
  roadmap: AnyRoadmapDto,
  { completedNodeIds, reviewedResourceIds }: SimulatedProgress,
): StudentRoadmapDto {
  if (roadmap.nodes.every((node) => 'access' in node)) return copy(roadmap as StudentRoadmapDto);
  return copy({
    course: roadmap.course,
    courseOffering: roadmap.courseOffering,
    roadmap: roadmap.roadmap,
    nodeTypes: roadmap.nodeTypes,
    ...studentRoadmapNodes({
      nodes: (roadmap as RoadmapDto).nodes,
      dependencies: roadmap.dependencies,
      completedNodeIds,
      reviewedResourceIds,
      isClosed: Boolean(roadmap.roadmap.closedAt),
    }),
  });
}

function requireCompletableNode(
  roadmap: AnyRoadmapDto,
  progress: SimulatedProgress,
  nodeId: string,
) {
  const node = asStudentRoadmap(roadmap, progress).nodes.find(({ id }) => id === nodeId);
  if (!node) return;
  if (node.access.status === 'BLOCKED') throw new Error(blockedNodeAccessMessage(node.access));
  if (
    'resources' in node &&
    !progress.completedNodeIds.has(nodeId) &&
    hasUnreviewedResources(node.resources)
  )
    throw new Error(unreviewedResourcesMessage);
}

function teachingNodes(roadmap: AnyRoadmapDto) {
  return roadmap.nodes.filter((node): node is RoadmapNode => 'isTeacherBlocked' in node);
}

function snapshotOf(roadmap: AnyRoadmapDto): RoadmapSnapshot {
  const nodes = teachingNodes(roadmap).map((node) => ({
    ...node,
    teacherUnlockAt: (node.isVisible && node.teacherUnlockAt) || null,
    teacherUnlockIncludesDependents:
      node.isVisible && Boolean(node.teacherUnlockIncludesDependents),
  }));
  return { ...roadmap, nodes, now: new Date() };
}

export type InMemoryStudentProgress = { completedNodeIds: readonly string[] };

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
  confirm(change: ChangeWithImpact, previewVersion?: string): void;
  requireAvailableNodeType(nodeTypeId: string): void;
  decideNodeType(change: NodeTypeChange): void;
  settleEach<Item>(items: readonly Item[], apply: (item: Item) => void): void;
};

export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: AnyRoadmapDto,
  options: { studentProgress?: InMemoryStudentProgress; createdNodePosition?: Point } = {},
): RoadmapCanvasSessionPersistence {
  const studentProgress: SimulatedProgress | null = options.studentProgress
    ? {
        completedNodeIds: new Set(options.studentProgress.completedNodeIds),
        reviewedResourceIds: new Set(),
      }
    : null;

  const practice: PracticeRoadmap = {
    roadmap: copy(initialRoadmap),
    canvasPreviewProgress: { completedNodeIds: new Set(), reviewedResourceIds: new Set() },
    createdNodePosition: options.createdNodePosition,

    complete(nodeId) {
      if (studentProgress) {
        requireCompletableNode(practice.roadmap, studentProgress, nodeId);
        studentProgress.completedNodeIds.add(nodeId);
        return;
      }
      practice.mutateNode(nodeId, (node) =>
        'isCompleted' in node ? { ...node, isCompleted: true, canComplete: false } : node,
      );
    },

    completeCanvasPreview(nodeId) {
      requireCompletableNode(practice.roadmap, practice.canvasPreviewProgress, nodeId);
      practice.canvasPreviewProgress.completedNodeIds.add(nodeId);
    },

    resetCanvasPreview() {
      practice.canvasPreviewProgress.completedNodeIds.clear();
      practice.canvasPreviewProgress.reviewedResourceIds.clear();
    },

    updateNodes(update) {
      const nodes = update(practice.roadmap.nodes);
      practice.roadmap = { ...practice.roadmap, nodes } as AnyRoadmapDto;
    },

    mutateNode(nodeId, update) {
      practice.updateNodes((nodes) =>
        nodes.map((node) => (node.id === nodeId ? update(node) : node)),
      );
    },

    mutateResource(resourceId, update) {
      practice.updateNodes((nodes) =>
        nodes.map((node) => {
          if (!('resources' in node)) return node;
          return {
            ...node,
            resources: node.resources.flatMap((resource) => {
              if (resource.id !== resourceId) return [resource];
              const next = update(resource);
              return next ? [next] : [];
            }),
          };
        }),
      );
    },

    appendResource(nodeId, resource) {
      practice.mutateNode(nodeId, (node) =>
        'resources' in node ? { ...node, resources: [...node.resources, resource] } : node,
      );
    },

    confirm(change, previewVersion) {
      const plan = confirmChange(snapshotOf(practice.roadmap), change, previewVersion);
      if (plan.kind === 'REJECTED') throw new Error(plan.message);
      const blocked = new Set(plan.consequences.blockedNodeIds);
      const unblocked = new Set(plan.consequences.unblockedNodeIds);
      const removed = new Set(plan.consequences.removedDependencyIds);
      const discarded = new Set(plan.consequences.discardedScheduleNodeIds);
      practice.updateNodes((nodes) =>
        nodes.map((node) => {
          if (!('isTeacherBlocked' in node)) return node;
          if (discarded.has(node.id))
            return {
              ...node,
              teacherUnlockAt: undefined,
              teacherUnlockIncludesDependents: undefined,
            };
          if (blocked.has(node.id)) return { ...node, isTeacherBlocked: true };
          if (unblocked.has(node.id))
            return {
              ...node,
              isTeacherBlocked: false,
              teacherUnlockAt: undefined,
              teacherUnlockIncludesDependents: undefined,
            };
          return node;
        }),
      );
      practice.roadmap = {
        ...practice.roadmap,
        dependencies: practice.roadmap.dependencies.filter(({ id }) => !removed.has(id)),
      };
    },

    requireAvailableNodeType(nodeTypeId) {
      const { nodeTypes } = practice.roadmap;
      const decision = decideNodeTypeAssignment({ nodeTypes, nodeTypeId });
      if (decision.kind === 'REJECTED') throw new Error(decision.message);
    },

    decideNodeType(change) {
      const { nodeTypes, nodes } = practice.roadmap;
      const decision = decideNodeTypeChange({ nodeTypes, nodes, change });
      if (decision.kind === 'REJECTED') throw new Error(decision.message);
    },

    settleEach(items, apply) {
      const failures: unknown[] = [];
      for (const item of items) {
        try {
          apply(item);
        } catch (cause) {
          failures.push(cause);
        }
      }
      if (failures.length > 0) throw failures[0];
    },
  };

  return {
    async recordResourceAccess(resource, scope) {
      const progress =
        scope === 'canvas-preview' ? practice.canvasPreviewProgress : studentProgress;
      progress?.reviewedResourceIds.add(resource.id);
      return { countsAccess: false };
    },

    async load() {
      return studentProgress
        ? asStudentRoadmap(practice.roadmap, studentProgress)
        : copy(practice.roadmap);
    },

    async loadCanvasPreview() {
      return asStudentRoadmap(practice.roadmap, practice.canvasPreviewProgress);
    },

    async readChangeImpact(command) {
      const plan = planChange(snapshotOf(practice.roadmap), command);
      if (plan.kind === 'REJECTED') throw new Error(plan.message);
      return plan.impact;
    },

    async execute(command, previewVersion) {
      const entry: AnyCommandEntry = canvasCommandCatalog[command.kind];
      return entry.practice(practice, command, previewVersion);
    },
  };
}
