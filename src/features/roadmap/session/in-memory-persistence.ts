import { externalResourceError, resourceEditError } from '@/features/roadmap/domain/resource';
import type { Point } from '@/features/roadmap/graph/geometry';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import {
  confirmChange,
  planChange,
  type ChangeConsequences,
  type RoadmapChange,
  type RoadmapSnapshot,
} from '@/features/roadmap/domain/change-impact';
import { studentRoadmapNodes } from '@/features/roadmap/domain/participant-view';
import {
  decideNodeTypeAssignment,
  decideNodeTypeChange,
  type NodeTypeChange,
} from '@/features/roadmap/domain/node-type';
import {
  chileCalendarDay,
  decideScheduledUnlock,
} from '@/features/roadmap/domain/scheduled-unlock';
import type {
  AnyRoadmapDto,
  Resource,
  RoadmapDependency,
  RoadmapDependencyRequest,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
} from '@/features/roadmap/types';
import type { ResourceInput } from '@/features/roadmap/editor/types';
import type {
  ChangeImpactCommand,
  ReadChangeImpactOf,
  RoadmapNodePlacement,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  NewRoadmapNode,
  RoadmapCanvasSessionPersistence,
  RoadmapNodeTypeInput,
} from '@/features/roadmap/session/types';

function copy<T>(value: T): T {
  return structuredClone(value);
}

type AnyRoadmapNode = AnyRoadmapDto['nodes'][number];

function replaceRoadmapNode(
  roadmap: AnyRoadmapDto,
  nodeId: string,
  update: (node: AnyRoadmapNode) => AnyRoadmapNode,
) {
  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => (node.id === nodeId ? update(node) : node)),
  } as AnyRoadmapDto;
}

function nodeResources(node: AnyRoadmapNode): Resource[] {
  return 'resources' in node ? node.resources : [];
}

function asStudentRoadmap(
  roadmap: AnyRoadmapDto,
  completedNodeIds: ReadonlySet<string>,
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
      isClosed: Boolean(roadmap.roadmap.closedAt),
    }),
  });
}

function resourceUpdate(
  roadmap: AnyRoadmapDto,
  resourceId: string,
  update: (resource: Resource) => Resource | null,
) {
  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => {
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
  } as AnyRoadmapDto;
}

function teachingNodes(roadmap: AnyRoadmapDto) {
  return roadmap.nodes.filter((node): node is RoadmapNode => 'isTeacherBlocked' in node);
}

function snapshotOf(roadmap: AnyRoadmapDto): RoadmapSnapshot {
  return { ...roadmap, nodes: teachingNodes(roadmap), today: chileCalendarDay() };
}

function changeImpact(roadmap: AnyRoadmapDto, change: RoadmapChange) {
  const plan = planChange(snapshotOf(roadmap), change);
  if (plan.kind === 'REJECTED') throw new Error(plan.message);
  return plan.impact;
}

/** Applies every Node move of a batch, then rethrows the first failure, as the HTTP adapter does. */
function settleEach<Item>(items: readonly Item[], apply: (item: Item) => void) {
  const failures: unknown[] = [];
  for (const item of items) {
    try {
      apply(item);
    } catch (cause) {
      failures.push(cause);
    }
  }
  if (failures.length > 0) throw failures[0];
}

export type InMemoryStudentProgress = { completedNodeIds: readonly string[] };

export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: AnyRoadmapDto,
  options: { studentProgress?: InMemoryStudentProgress; createdNodePosition?: Point } = {},
): RoadmapCanvasSessionPersistence {
  let roadmap = copy(initialRoadmap);
  const studentCompletions = options.studentProgress
    ? new Set(options.studentProgress.completedNodeIds)
    : null;
  let canvasPreviewCompletions = new Set<string>();

  const mutateNode = (nodeId: string, update: (node: AnyRoadmapNode) => AnyRoadmapNode) => {
    roadmap = replaceRoadmapNode(roadmap, nodeId, update);
  };

  const decideNodeType = (change: NodeTypeChange) => {
    const decision = decideNodeTypeChange({
      nodeTypes: roadmap.nodeTypes,
      nodes: roadmap.nodes,
      change,
    });
    if (decision.kind === 'REJECTED') throw new Error(decision.message);
  };

  const requireAvailableNodeType = (nodeTypeId: string) => {
    const decision = decideNodeTypeAssignment({ nodeTypes: roadmap.nodeTypes, nodeTypeId });
    if (decision.kind === 'REJECTED') throw new Error(decision.message);
  };

  const appendResource = (nodeId: string, resource: Resource) =>
    mutateNode(nodeId, (node) =>
      'resources' in node
        ? ({ ...node, resources: [...node.resources, resource] } as AnyRoadmapNode)
        : node,
    );

  const moveNodes = (positions: readonly RoadmapNodePlacement[]) =>
    settleEach(positions, ({ nodeId, position }) =>
      mutateNode(
        nodeId,
        (node) => ({ ...node, positionX: position.x, positionY: position.y }) as AnyRoadmapNode,
      ),
    );

  const setVisibility = (nodeId: string, isVisible: boolean) =>
    mutateNode(nodeId, (node) =>
      'isVisible' in node ? ({ ...node, isVisible } as AnyRoadmapNode) : node,
    );

  const complete = (nodeId: string) => {
    if (studentCompletions) {
      const access = asStudentRoadmap(roadmap, studentCompletions).nodes.find(
        ({ id }) => id === nodeId,
      )?.access;
      if (access?.status === 'BLOCKED') throw new Error(blockedNodeAccessMessage(access));
      studentCompletions.add(nodeId);
      return;
    }
    mutateNode(nodeId, (node) =>
      'isCompleted' in node ? { ...node, isCompleted: true, canComplete: false } : node,
    );
  };

  const addNode = (node: NewRoadmapNode, requested: Point) => {
    requireAvailableNodeType(node.nodeTypeId);
    const id = crypto.randomUUID();
    const position = options.createdNodePosition ?? requested;
    const created: RoadmapNode = {
      id,
      title: node.title,
      description: node.description || null,
      nodeTypeId: node.nodeTypeId,
      positionX: position.x,
      positionY: position.y,
      isVisible: node.isVisible,
      isTeacherBlocked: false,
      resources: [],
    };
    roadmap = { ...roadmap, nodes: [...roadmap.nodes, created] } as AnyRoadmapDto;
    return id;
  };

  const applyConsequences = (consequences: ChangeConsequences) => {
    const blocked = new Set(consequences.blockedNodeIds);
    const unblocked = new Set(consequences.unblockedNodeIds);
    const removed = new Set(consequences.removedDependencyIds);
    roadmap = {
      ...roadmap,
      nodes: roadmap.nodes.map((node) => {
        if (!('isTeacherBlocked' in node)) return node;
        if (blocked.has(node.id)) return { ...node, isTeacherBlocked: true };
        if (unblocked.has(node.id))
          return { ...node, isTeacherBlocked: false, teacherUnlockOn: undefined };
        return node;
      }),
      dependencies: roadmap.dependencies.filter(({ id }) => !removed.has(id)),
    } as AnyRoadmapDto;
  };

  const confirm = (change: RoadmapChange, previewVersion?: string) => {
    const plan = confirmChange(snapshotOf(roadmap), change, previewVersion);
    if (plan.kind === 'REJECTED') throw new Error(plan.message);
    applyConsequences(plan.consequences);
  };

  const connectNodes = (request: RoadmapDependencyRequest, previewVersion?: string) => {
    confirm({ kind: 'create-dependency', ...request }, previewVersion);
    const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = request;
    const dependency: RoadmapDependency = {
      id: crypto.randomUUID(),
      sourceNodeId,
      targetNodeId,
      sourceHandle,
      targetHandle,
    };
    roadmap = { ...roadmap, dependencies: [...roadmap.dependencies, dependency] };
  };

  const scheduleTeacherUnlock = (nodeId: string, unlockOn: string | null) =>
    mutateNode(nodeId, (node) => {
      if (!('isTeacherBlocked' in node)) return node;
      const decision = decideScheduledUnlock({ node, unlockOn, today: chileCalendarDay() });
      if (decision.kind === 'REJECTED') throw new Error(decision.message);
      return { ...node, teacherUnlockOn: decision.day ?? undefined } as AnyRoadmapNode;
    });

  const deleteDependency = (dependencyId: string) => {
    if (!roadmap.dependencies.some(({ id }) => id === dependencyId))
      throw new Error('La dependencia no existe en este roadmap.');
    roadmap = {
      ...roadmap,
      dependencies: roadmap.dependencies.filter(({ id }) => id !== dependencyId),
    };
  };

  const deleteNode = (nodeId: string, previewVersion?: string) => {
    confirm({ kind: 'delete-node', nodeId }, previewVersion);
    roadmap = {
      ...roadmap,
      nodes: roadmap.nodes.filter(({ id }) => id !== nodeId),
    } as AnyRoadmapDto;
  };

  const updateResource = (resourceId: string, resource: ResourceInput) => {
    roadmap = resourceUpdate(roadmap, resourceId, (current) => {
      const changes =
        current.type === 'FILE' && resource.type === 'FILE' && resource.url === current.url
          ? { title: resource.title }
          : resource;
      const error = resourceEditError(current.type, changes);
      if (error) throw new Error(error);
      return { ...current, ...changes };
    });
  };

  const addNodeType = (nodeType: RoadmapNodeTypeInput) => {
    decideNodeType({ kind: 'create', name: nodeType.name });
    const id = crypto.randomUUID();
    roadmap = {
      ...roadmap,
      nodeTypes: [...roadmap.nodeTypes, { ...nodeType, id, isPredefined: false }],
    } as AnyRoadmapDto;
  };

  const updateNodeType = (nodeTypeId: string, nodeType: RoadmapNodeTypeInput) => {
    decideNodeType({ kind: 'update', nodeTypeId, name: nodeType.name });
    roadmap = {
      ...roadmap,
      nodeTypes: roadmap.nodeTypes.map((current) =>
        current.id === nodeTypeId ? { ...current, ...nodeType } : current,
      ),
    };
  };

  const deleteNodeType = (nodeTypeId: string) => {
    decideNodeType({ kind: 'delete', nodeTypeId });
    roadmap = {
      ...roadmap,
      nodeTypes: roadmap.nodeTypes.filter(({ id }) => id !== nodeTypeId),
    } as AnyRoadmapDto;
  };

  return {
    async load() {
      return studentCompletions ? asStudentRoadmap(roadmap, studentCompletions) : copy(roadmap);
    },

    async loadCanvasPreview() {
      return asStudentRoadmap(roadmap, canvasPreviewCompletions);
    },

    async readChangeImpact<Command extends ChangeImpactCommand>(command: Command) {
      // The module plans each kind's own Change impact; TypeScript cannot narrow it per kind.
      return changeImpact(roadmap, command) as ReadChangeImpactOf<Command['kind']>;
    },

    async execute(command, previewVersion) {
      switch (command.kind) {
        case 'complete-node':
          return complete(command.nodeId);
        case 'add-node':
          return { createdNodeId: addNode(command.node, command.position) };
        case 'update-node':
          requireAvailableNodeType(command.value.nodeTypeId);
          return mutateNode(
            command.nodeId,
            (node) =>
              ({
                ...node,
                title: command.value.title,
                description: command.value.description || null,
                nodeTypeId: command.value.nodeTypeId,
              }) as AnyRoadmapNode,
          );
        case 'move-nodes':
        case 'apply-automatic-layout':
          return moveNodes(command.positions);
        case 'create-dependency':
          return connectNodes(command, previewVersion);
        case 'delete-dependency':
          return deleteDependency(command.dependencyId);
        case 'change-teacher-block':
          return confirm(command, previewVersion);
        case 'schedule-teacher-unlock':
          return scheduleTeacherUnlock(command.nodeId, command.unlockOn);
        case 'hide-node':
          confirm(command, previewVersion);
          return setVisibility(command.nodeId, false);
        case 'show-node':
          return setVisibility(command.nodeId, true);
        case 'delete-node':
          return deleteNode(command.nodeId, previewVersion);
        case 'add-resource': {
          const error = externalResourceError(command.resource.type);
          if (error) throw new Error(error);
          return appendResource(command.nodeId, { ...command.resource, id: crypto.randomUUID() });
        }
        case 'upload-resource':
          return appendResource(command.nodeId, {
            id: crypto.randomUUID(),
            title: command.file.name,
            url: command.file.name,
            type: 'FILE',
          });
        case 'update-resource':
          return updateResource(command.resourceId, command.resource);
        case 'delete-resource':
          roadmap = resourceUpdate(roadmap, command.resourceId, () => null);
          return;
        case 'add-node-type':
          return addNodeType(command.nodeType);
        case 'update-node-type':
          return updateNodeType(command.nodeTypeId, command.nodeType);
        case 'delete-node-type':
          return deleteNodeType(command.nodeTypeId);
        case 'complete-canvas-preview-node':
          canvasPreviewCompletions = new Set([...canvasPreviewCompletions, command.nodeId]);
          return;
        case 'reset-canvas-preview':
          canvasPreviewCompletions = new Set();
          return;
      }
    },
  };
}
