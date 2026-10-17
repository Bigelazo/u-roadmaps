import type { Point } from '@/features/roadmap/graph/geometry';
import { blockedNodeAccessMessage } from '@/features/roadmap/domain/access';
import {
  decidePreviewVersion,
  type PreviewedChange,
} from '@/features/roadmap/domain/change-impact';
import { studentRoadmapNodes } from '@/features/roadmap/domain/participant-view';
import { decideDependency } from '@/features/roadmap/domain/dependency';
import { decideNodeTypeChange, type NodeTypeChange } from '@/features/roadmap/domain/node-type';
import { decideVisibilityChange } from '@/features/roadmap/domain/node-visibility';
import {
  chileCalendarDay,
  decideScheduledUnlock,
} from '@/features/roadmap/domain/scheduled-unlock';
import { decideTeacherBlock } from '@/features/roadmap/domain/teacher-block';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';
import type {
  AnyRoadmapDto,
  DependencyImpact,
  NodeDeletionImpact,
  NodeHidingImpact,
  Resource,
  RoadmapDependency,
  RoadmapDependencyRequest,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type { NodeUpdate, ResourceInput } from '@/features/roadmap/editor/types';
import type {
  NewRoadmapNode,
  RoadmapCanvasSessionInput,
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

/** Projects a teaching Roadmap for a student with the given Completions, as the server does. */
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

function incidentDependencies(roadmap: AnyRoadmapDto, nodeId: string) {
  return roadmap.dependencies.filter(
    ({ sourceNodeId, targetNodeId }) => sourceNodeId === nodeId || targetNodeId === nodeId,
  );
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

/** A Change impact with a version derived from its content, as the server derives its own. */
function versioned<Impact extends object>(impact: Impact) {
  return { ...impact, version: JSON.stringify(impact) };
}

/** Rejects a confirmation whose sent preview version no longer matches the current impact. */
function rejectStalePreview(
  change: PreviewedChange,
  sentVersion: string | undefined,
  { version }: { version: string },
) {
  const decision = decidePreviewVersion({ change, sentVersion, version });
  if (decision.kind === 'REJECTED') throw new Error(decision.message);
}

function teachingNodes(roadmap: AnyRoadmapDto) {
  return roadmap.nodes.filter((node): node is RoadmapNode => 'isTeacherBlocked' in node);
}

function dependencyImpact(
  roadmap: AnyRoadmapDto,
  { sourceNodeId, targetNodeId }: RoadmapDependencyRequest,
): DependencyImpact {
  const decision = decideDependency({
    nodes: teachingNodes(roadmap),
    dependencies: roadmap.dependencies,
    sourceNodeId,
    targetNodeId,
  });
  if (decision.kind === 'REJECTED') throw new Error(decision.message);
  return versioned({ nodes: decision.teacherBlockedNodes });
}

function hidingImpact(roadmap: AnyRoadmapDto, nodeId: string): NodeHidingImpact {
  return versioned({
    dependencies: decideVisibilityChange({
      nodeId,
      isVisible: false,
      dependencies: roadmap.dependencies,
    }).removedDependencies.map(({ id, sourceNodeId, targetNodeId }) => ({
      id,
      sourceNodeId,
      targetNodeId,
    })),
  });
}

function nodeTypeFor(roadmap: AnyRoadmapDto, nodeId: string) {
  const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
  const nodeType = roadmap.nodeTypes.find((candidate) => candidate.id === node?.nodeTypeId);
  return nodeType ?? unknownNodeType;
}

function deletionImpact(roadmap: AnyRoadmapDto, nodeId: string): NodeDeletionImpact {
  const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
  const { name, icon, color } = nodeTypeFor(roadmap, nodeId);
  const titleOf = (id: string) =>
    roadmap.nodes.find((candidate) => candidate.id === id)?.title ?? '';
  return versioned({
    node: { title: node?.title ?? '', nodeType: { name, icon, color } },
    dependencies: incidentDependencies(roadmap, nodeId).map(
      ({ id, sourceNodeId, targetNodeId }) => ({
        id,
        sourceTitle: titleOf(sourceNodeId),
        targetTitle: titleOf(targetNodeId),
      }),
    ),
    resources: (node ? nodeResources(node) : []).map(({ id, title }) => ({ id, title })),
  });
}

function teacherBlockDecision(
  roadmap: AnyRoadmapDto,
  nodeId: string,
  operation: TeacherBlockOperation,
) {
  return decideTeacherBlock({
    nodes: roadmap.nodes.flatMap((node) => {
      if (!('isTeacherBlocked' in node)) return [];
      return [{ ...node, nodeType: nodeTypeFor(roadmap, node.id) }];
    }),
    dependencies: roadmap.dependencies,
    nodeId,
    operation,
  });
}

function teacherBlockPreview(
  roadmap: AnyRoadmapDto,
  nodeId: string,
  operation: TeacherBlockOperation,
): TeacherBlockPreview {
  const decision = teacherBlockDecision(roadmap, nodeId, operation);
  if (decision.kind === 'REJECTED') throw new Error(decision.message);
  return versioned({ mode: decision.mode, nodes: decision.nodes });
}

export type InMemoryStudentProgress = { completedNodeIds: readonly string[] };

/**
 * A Roadmap canvas persistence held in memory that follows the server's Roadmap rules.
 * Seeded with a teaching Roadmap and `studentProgress`, it serves that student's view
 * of the Roadmap and records their Completions locally. With `createdNodePosition`, every
 * created Node lands there instead of where it was asked to go.
 */
export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: AnyRoadmapDto,
  options: { studentProgress?: InMemoryStudentProgress; createdNodePosition?: Point } = {},
): RoadmapCanvasSessionPersistence {
  let roadmap = copy(initialRoadmap);
  const studentCompletions = options.studentProgress
    ? new Set(options.studentProgress.completedNodeIds)
    : null;
  let simulatedCompletions = new Set<string>();

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

  const appendResource = (nodeId: string, resource: Resource) =>
    mutateNode(nodeId, (node) =>
      'resources' in node
        ? ({ ...node, resources: [...node.resources, resource] } as AnyRoadmapNode)
        : node,
    );

  return {
    async load() {
      return studentCompletions ? asStudentRoadmap(roadmap, studentCompletions) : copy(roadmap);
    },

    async complete(_input: RoadmapCanvasSessionInput, nodeId: string) {
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
    },

    async loadSimulation() {
      return asStudentRoadmap(roadmap, simulatedCompletions);
    },

    async addNode(_input: RoadmapCanvasSessionInput, node: NewRoadmapNode, requested: Point) {
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
    },

    async updateNode(_input: RoadmapCanvasSessionInput, nodeId: string, update: NodeUpdate) {
      mutateNode(
        nodeId,
        (node) =>
          ({
            ...node,
            title: update.title,
            description: update.description || null,
            nodeTypeId: update.nodeTypeId,
          }) as AnyRoadmapNode,
      );
    },

    async moveNode(_input: RoadmapCanvasSessionInput, nodeId: string, position: Point) {
      mutateNode(
        nodeId,
        (node) =>
          ({
            ...node,
            positionX: position.x,
            positionY: position.y,
          }) as AnyRoadmapNode,
      );
    },

    async previewRoadmapDependency(_input, request) {
      return dependencyImpact(roadmap, request);
    },

    async connectNodes(
      _input: RoadmapCanvasSessionInput,
      request: RoadmapDependencyRequest,
      previewVersion?: string,
    ) {
      const impact = dependencyImpact(roadmap, request);
      rejectStalePreview('dependency', previewVersion, impact);
      const { sourceNodeId, targetNodeId, sourceHandle, targetHandle } = request;
      const dependency: RoadmapDependency = {
        id: crypto.randomUUID(),
        sourceNodeId,
        targetNodeId,
        sourceHandle,
        targetHandle,
      };
      roadmap = {
        ...roadmap,
        dependencies: [...roadmap.dependencies, dependency],
        nodes: roadmap.nodes.map((node) =>
          impact.nodes.some(({ id }) => id === node.id) && 'isTeacherBlocked' in node
            ? { ...node, isTeacherBlocked: true }
            : node,
        ),
      } as AnyRoadmapDto;
    },

    async previewTeacherBlock(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      operation: TeacherBlockOperation,
    ) {
      return teacherBlockPreview(roadmap, nodeId, operation);
    },

    async changeTeacherBlock(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      operation: TeacherBlockOperation,
      previewVersion?: string,
    ) {
      const preview = teacherBlockPreview(roadmap, nodeId, operation);
      rejectStalePreview(operation === 'BLOCK' ? 'block' : 'unlock', previewVersion, preview);
      const changedNodeIds = new Set(preview.nodes.map((node) => node.id));
      roadmap = {
        ...roadmap,
        nodes: roadmap.nodes.map((node) =>
          changedNodeIds.has(node.id) && 'isTeacherBlocked' in node
            ? ({
                ...node,
                isTeacherBlocked: operation === 'BLOCK',
                ...(operation === 'BLOCK' ? {} : { teacherUnlockOn: undefined }),
              } as AnyRoadmapNode)
            : node,
        ),
      } as AnyRoadmapDto;
    },

    async scheduleTeacherUnlock(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      unlockOn: string | null,
    ) {
      // A schedule is always after today and a Practice roadmap lives for one session, so no
      // Scheduled unlock falls due here and unblocking never has one to release.
      mutateNode(nodeId, (node) => {
        if (!('isTeacherBlocked' in node)) return node;
        const decision = decideScheduledUnlock({ node, unlockOn, today: chileCalendarDay() });
        if (decision.kind === 'REJECTED') throw new Error(decision.message);
        return { ...node, teacherUnlockOn: decision.day ?? undefined } as AnyRoadmapNode;
      });
    },

    async deleteDependency(_input: RoadmapCanvasSessionInput, dependencyIdToDelete: string) {
      if (!roadmap.dependencies.some(({ id }) => id === dependencyIdToDelete))
        throw new Error('La dependencia no existe en este roadmap.');
      roadmap = {
        ...roadmap,
        dependencies: roadmap.dependencies.filter(({ id }) => id !== dependencyIdToDelete),
      };
    },

    async previewNodeHiding(_input: RoadmapCanvasSessionInput, nodeId: string) {
      return hidingImpact(roadmap, nodeId);
    },

    async setVisibility(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      visible: boolean,
      previewVersion?: string,
    ) {
      if (!visible) rejectStalePreview('hide', previewVersion, hidingImpact(roadmap, nodeId));
      const change = decideVisibilityChange({
        nodeId,
        isVisible: visible,
        dependencies: roadmap.dependencies,
      });
      mutateNode(nodeId, (node) =>
        'isVisible' in node
          ? ({
              ...node,
              isVisible: visible,
              ...(change.clearsTeacherBlock
                ? { isTeacherBlocked: false, teacherUnlockOn: undefined }
                : {}),
            } as AnyRoadmapNode)
          : node,
      );
      const removed = new Set(change.removedDependencies.map(({ id }) => id));
      roadmap = {
        ...roadmap,
        dependencies: roadmap.dependencies.filter(({ id }) => !removed.has(id)),
      };
    },

    async previewNodeDeletion(_input: RoadmapCanvasSessionInput, nodeId: string) {
      return deletionImpact(roadmap, nodeId);
    },

    async deleteNode(_input: RoadmapCanvasSessionInput, nodeId: string, previewVersion?: string) {
      rejectStalePreview('delete', previewVersion, deletionImpact(roadmap, nodeId));
      roadmap = {
        ...roadmap,
        nodes: roadmap.nodes.filter(({ id }) => id !== nodeId),
        dependencies: roadmap.dependencies.filter(
          ({ sourceNodeId, targetNodeId }) => sourceNodeId !== nodeId && targetNodeId !== nodeId,
        ),
      } as AnyRoadmapDto;
    },

    async addResource(_input: RoadmapCanvasSessionInput, nodeId: string, resource: ResourceInput) {
      appendResource(nodeId, { ...resource, id: crypto.randomUUID() });
    },

    async uploadResource(_input: RoadmapCanvasSessionInput, nodeId: string, file: File) {
      appendResource(nodeId, {
        id: crypto.randomUUID(),
        title: file.name,
        url: file.name,
        type: 'FILE',
      });
    },

    async updateResource(
      _input: RoadmapCanvasSessionInput,
      resourceId: string,
      resource: ResourceInput,
    ) {
      roadmap = resourceUpdate(roadmap, resourceId, (current) => ({ ...current, ...resource }));
    },

    async deleteResource(_input: RoadmapCanvasSessionInput, resourceId: string) {
      roadmap = resourceUpdate(roadmap, resourceId, () => null);
    },

    async addNodeType(_input: RoadmapCanvasSessionInput, nodeType: RoadmapNodeTypeInput) {
      decideNodeType({ kind: 'create', name: nodeType.name });
      const id = crypto.randomUUID();
      roadmap = {
        ...roadmap,
        nodeTypes: [...roadmap.nodeTypes, { ...nodeType, id, isPredefined: false }],
      } as AnyRoadmapDto;
    },

    async updateNodeType(
      _input: RoadmapCanvasSessionInput,
      nodeTypeId: string,
      nodeType: RoadmapNodeTypeInput,
    ) {
      decideNodeType({ kind: 'update', nodeTypeId, name: nodeType.name });
      roadmap = {
        ...roadmap,
        nodeTypes: roadmap.nodeTypes.map((current) =>
          current.id === nodeTypeId ? { ...current, ...nodeType } : current,
        ),
      };
    },

    async deleteNodeType(_input: RoadmapCanvasSessionInput, nodeTypeId: string) {
      decideNodeType({ kind: 'delete', nodeTypeId });
      roadmap = {
        ...roadmap,
        nodeTypes: roadmap.nodeTypes.filter(({ id }) => id !== nodeTypeId),
      } as AnyRoadmapDto;
    },

    async completeSimulatedNode(_input: RoadmapCanvasSessionInput, nodeId: string) {
      simulatedCompletions = new Set([...simulatedCompletions, nodeId]);
    },

    async resetSimulation() {
      simulatedCompletions = new Set();
    },
  };
}
