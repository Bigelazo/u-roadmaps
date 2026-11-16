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

function positionedNodes(nodes: AnyRoadmapNode[], positions: readonly RoadmapNodePlacement[]) {
  const nodeIds = new Set(nodes.map(({ id }) => id));
  const targets = new Map<string, RoadmapNodePlacement['position']>();
  for (const { nodeId, position } of positions) {
    if (typeof nodeId !== 'string' || !nodeId.trim() || targets.has(nodeId))
      throw new Error('Cada nodo debe tener una identidad válida y única.');
    if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
      throw new Error('La posición debe contener números finitos.');
    if (!nodeIds.has(nodeId)) throw new Error('El nodo no existe en este roadmap.');
    targets.set(nodeId, position);
  }
  return nodes.map((node) => {
    const position = targets.get(node.id);
    return position ? { ...node, positionX: position.x, positionY: position.y } : node;
  });
}

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

const moveNodes = (practice: PracticeRoadmap, positions: readonly RoadmapNodePlacement[]) => {
  if (practice.roadmap.roadmap.closedAt)
    throw new Error('Este roadmap está cerrado y es de sólo lectura.');
  if (!positions.length) return;
  practice.updateNodes((nodes) => positionedNodes(nodes, positions));
};

const createNode: PracticeCommand<CanvasCommandOf<'add-node'>> = (
  practice,
  { nodeId, node, position: requested, displaced },
) => {
  if (practice.roadmap.roadmap.closedAt)
    throw new Error('Este roadmap está cerrado y es de sólo lectura.');
  if (typeof nodeId !== 'string' || !nodeId.trim())
    throw new Error('El nodo debe tener una identidad válida.');
  if (practice.roadmap.nodes.some(({ id }) => id === nodeId)) return { createdNodeId: nodeId };
  practice.requireAvailableNodeType(node.nodeTypeId);
  if (typeof node.isVisible !== 'boolean')
    throw new Error('La visibilidad debe ser un valor booleano.');
  if (!node.title.trim() || node.title.trim().length > 240)
    throw new Error('El título debe ser un texto no vacío de hasta 240 caracteres.');
  if (node.description && !node.description.trim())
    throw new Error('La descripción debe ser un texto no vacío.');
  if (!Number.isFinite(requested.x) || !Number.isFinite(requested.y))
    throw new Error('La posición debe contener números finitos.');
  positionedNodes(practice.roadmap.nodes, displaced);
  const position = practice.createdNodePosition ?? requested;
  const positions = practice.createdNodePosition
    ? nodesDisplacedByNewNode(
        practice.roadmap.nodes.map(({ id, title, positionX, positionY }) => ({
          id,
          title,
          position: { x: positionX, y: positionY },
        })),
        { id: nodeId, title: node.title, position },
      )
    : displaced;
  const placed = positionedNodes(practice.roadmap.nodes, positions);
  practice.updateNodes(() => [
    ...placed,
    {
      id: nodeId,
      title: node.title.trim(),
      description: node.description || null,
      nodeTypeId: node.nodeTypeId,
      positionX: position.x,
      positionY: position.y,
      isVisible: node.isVisible,
      isTeacherBlocked: false,
      resources: [],
    },
  ]);
  return { createdNodeId: nodeId };
};

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
  'add-node': createNode,
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
