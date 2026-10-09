import type { Point } from '@/features/roadmap/graph/geometry';
import {
  studentNodeAccessById,
  transitiveDependentNodeIds,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
import { decideTeacherBlock } from '@/features/roadmap/domain/teacher-block';
import type {
  AnyRoadmapDto,
  NodeDeletionImpact,
  Resource,
  RoadmapDependency,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
  TeacherBlockImpact,
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

function replaceRoadmapNode(
  roadmap: AnyRoadmapDto,
  nodeId: string,
  update: (node: AnyRoadmapDto['nodes'][number]) => AnyRoadmapDto['nodes'][number],
) {
  return {
    ...roadmap,
    nodes: roadmap.nodes.map((node) => (node.id === nodeId ? update(node) : node)),
  } as AnyRoadmapDto;
}

function nodeResources(node: AnyRoadmapDto['nodes'][number]): Resource[] {
  return 'resources' in node ? node.resources : [];
}

/** Projects a teaching Roadmap for a student with the given Completions, as the server does. */
function asStudentRoadmap(
  roadmap: AnyRoadmapDto,
  completedNodeIds: ReadonlySet<string>,
): StudentRoadmapDto {
  if (roadmap.nodes.every((node) => 'access' in node)) return copy(roadmap as StudentRoadmapDto);
  const visibleNodes = (roadmap as RoadmapDto).nodes.filter((node) => node.isVisible);
  const visibleNodeIds = new Set(visibleNodes.map(({ id }) => id));
  const dependencies = roadmap.dependencies.filter(
    ({ sourceNodeId, targetNodeId }) =>
      visibleNodeIds.has(sourceNodeId) && visibleNodeIds.has(targetNodeId),
  );
  const accessByNodeId = studentNodeAccessById({
    nodes: visibleNodes,
    dependencies,
    completedNodeIds,
  });
  const nodes = visibleNodes.map<StudentRoadmapNode>((node) => {
    const summary = {
      id: node.id,
      title: node.title,
      nodeTypeId: node.nodeTypeId,
      positionX: node.positionX,
      positionY: node.positionY,
    };
    const access = accessByNodeId.get(node.id) ?? { status: 'ACCESSIBLE' };
    if (access.status === 'BLOCKED') return { ...summary, access };
    const isCompleted = completedNodeIds.has(node.id);
    return {
      ...summary,
      isVisible: true,
      access,
      description: node.description,
      isCompleted,
      canComplete: !isCompleted,
      resources: copy(node.resources),
    };
  });
  return {
    course: copy(roadmap.course),
    courseOffering: copy(roadmap.courseOffering),
    roadmap: copy(roadmap.roadmap),
    nodeTypes: copy(roadmap.nodeTypes),
    nodes,
    dependencies: copy(dependencies),
  };
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

function newResourceId(roadmap: AnyRoadmapDto) {
  const ids = new Set(roadmap.nodes.flatMap(nodeResources).map((resource) => resource.id));
  let index = ids.size + 1;
  while (ids.has(`resource-${index}`)) index += 1;
  return `resource-${index}`;
}

function dependencyId(roadmap: AnyRoadmapDto) {
  return `dependency-${roadmap.dependencies.length + 1}`;
}

function dependencyImpact(
  roadmap: AnyRoadmapDto,
  sourceNodeId: string,
  targetNodeId: string,
): TeacherBlockImpact[] {
  const sourceNode = roadmap.nodes.find(({ id }) => id === sourceNodeId);
  const targetNode = roadmap.nodes.find(({ id }) => id === targetNodeId);
  if (
    !sourceNode ||
    !targetNode ||
    !('isTeacherBlocked' in sourceNode) ||
    !('isTeacherBlocked' in targetNode)
  )
    throw new Error('La dependencia no existe en este roadmap.');
  if (!sourceNode.isVisible || !targetNode.isVisible)
    throw new Error('No se pueden crear dependencias con nodos ocultos.');
  if (
    roadmap.dependencies.some(
      (dependency) =>
        dependency.sourceNodeId === sourceNodeId && dependency.targetNodeId === targetNodeId,
    )
  )
    throw new Error('La dependencia ya existe.');
  if (wouldCreateDependencyCycle(roadmap.dependencies, sourceNodeId, targetNodeId))
    throw new Error('La dependencia formaría un ciclo.');
  if (!sourceNode.isTeacherBlocked) return [];

  const affectedNodeIds = new Set([
    targetNodeId,
    ...transitiveDependentNodeIds(roadmap.dependencies, targetNodeId),
  ]);
  return roadmap.nodes
    .filter(
      (node) =>
        'isTeacherBlocked' in node &&
        node.isVisible &&
        !node.isTeacherBlocked &&
        affectedNodeIds.has(node.id),
    )
    .map(({ id, title }) => ({ id, title }))
    .sort((left, right) => left.title.localeCompare(right.title));
}

function nodeTypeFor(roadmap: AnyRoadmapDto, nodeId: string) {
  const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
  const nodeType = roadmap.nodeTypes.find((candidate) => candidate.id === node?.nodeTypeId);
  return nodeType ?? { name: 'Sin tipo', icon: 'Shapes', color: '#000000' };
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
  if (decision.kind === 'REJECTED') throw new Error('No se pudo cambiar el bloqueo docente.');
  return { ...decision, version: 'in-memory-preview' };
}

export type InMemoryStudentProgress = { completedNodeIds: readonly string[] };

/**
 * A Roadmap canvas persistence held in memory that follows the server's Roadmap rules.
 * Seeded with a teaching Roadmap and `studentProgress`, it serves that student's view
 * of the Roadmap and records their Completions locally.
 */
export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: AnyRoadmapDto,
  options: { studentProgress?: InMemoryStudentProgress } = {},
): RoadmapCanvasSessionPersistence {
  let roadmap = copy(initialRoadmap);
  const studentCompletions = options.studentProgress
    ? new Set(options.studentProgress.completedNodeIds)
    : null;
  let simulatedCompletions = new Set<string>();
  let simulation: StudentRoadmapDto | null = null;
  let nextNodeNumber = roadmap.nodes.length + 1;

  const refreshSimulation = () => {
    simulation = asStudentRoadmap(roadmap, simulatedCompletions);
  };

  const mutateNode = (
    nodeId: string,
    update: (node: AnyRoadmapDto['nodes'][number]) => AnyRoadmapDto['nodes'][number],
  ) => {
    roadmap = replaceRoadmapNode(roadmap, nodeId, update);
    simulation = null;
  };

  return {
    async load() {
      return studentCompletions ? asStudentRoadmap(roadmap, studentCompletions) : copy(roadmap);
    },

    async complete(_input: RoadmapCanvasSessionInput, nodeId: string) {
      if (studentCompletions) {
        studentCompletions.add(nodeId);
        return;
      }
      roadmap = replaceRoadmapNode(roadmap, nodeId, (node) =>
        'isCompleted' in node ? { ...node, isCompleted: true, canComplete: false } : node,
      );
    },

    async loadSimulation() {
      refreshSimulation();
      return copy(simulation!);
    },

    async addNode(_input: RoadmapCanvasSessionInput, node: NewRoadmapNode, position: Point) {
      const id = `node-${nextNodeNumber++}`;
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
      simulation = null;
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
          }) as AnyRoadmapDto['nodes'][number],
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
          }) as AnyRoadmapDto['nodes'][number],
      );
    },

    async connectNodes(
      _input: RoadmapCanvasSessionInput,
      sourceNodeId: string,
      targetNodeId: string,
      sourceHandle = 'right',
      targetHandle = 'left',
    ) {
      const affectedNodes = dependencyImpact(roadmap, sourceNodeId, targetNodeId);
      const dependency: RoadmapDependency = {
        id: dependencyId(roadmap),
        sourceNodeId,
        targetNodeId,
        sourceHandle: sourceHandle as RoadmapDependency['sourceHandle'],
        targetHandle: targetHandle as RoadmapDependency['targetHandle'],
      };
      roadmap = {
        ...roadmap,
        dependencies: [...roadmap.dependencies, dependency],
        nodes: roadmap.nodes.map((node) =>
          affectedNodes.some(({ id }) => id === node.id) && 'isTeacherBlocked' in node
            ? { ...node, isTeacherBlocked: true }
            : node,
        ),
      } as AnyRoadmapDto;
    },

    async previewRoadmapDependency(_input, sourceNodeId, targetNodeId) {
      return dependencyImpact(roadmap, sourceNodeId, targetNodeId);
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
    ) {
      const preview = teacherBlockPreview(roadmap, nodeId, operation);
      const changedNodeIds = new Set(preview.nodes.map((node) => node.id));
      roadmap = {
        ...roadmap,
        nodes: roadmap.nodes.map((node) =>
          changedNodeIds.has(node.id) && 'isTeacherBlocked' in node
            ? ({
                ...node,
                isTeacherBlocked: operation === 'BLOCK',
                ...(operation === 'BLOCK' ? {} : { teacherUnlockOn: undefined }),
              } as AnyRoadmapDto['nodes'][number])
            : node,
        ),
      } as AnyRoadmapDto;
      simulation = null;
    },

    async scheduleTeacherUnlock(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      unlockOn: string | null,
    ) {
      mutateNode(nodeId, (node) => {
        if (!('isTeacherBlocked' in node)) return node;
        if (unlockOn && !node.isTeacherBlocked)
          throw new Error('Solo se puede programar el desbloqueo de un nodo con bloqueo docente.');
        return {
          ...node,
          teacherUnlockOn: unlockOn ?? undefined,
        } as AnyRoadmapDto['nodes'][number];
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

    async toggleVisibility(_input: RoadmapCanvasSessionInput, nodeId: string, isVisible: boolean) {
      // `isVisible` is the current visibility; hiding removes the Node's Dependencies.
      mutateNode(nodeId, (node) =>
        'isVisible' in node
          ? ({
              ...node,
              isVisible: !isVisible,
              ...(isVisible ? { isTeacherBlocked: false, teacherUnlockOn: undefined } : {}),
            } as AnyRoadmapDto['nodes'][number])
          : node,
      );
      if (isVisible) {
        const removed = new Set(incidentDependencies(roadmap, nodeId).map(({ id }) => id));
        roadmap = {
          ...roadmap,
          dependencies: roadmap.dependencies.filter(({ id }) => !removed.has(id)),
        };
      }
    },

    async previewNodeVisibility(_input: RoadmapCanvasSessionInput, nodeId: string) {
      return incidentDependencies(roadmap, nodeId).map(({ id, sourceNodeId, targetNodeId }) => ({
        id,
        sourceNodeId,
        targetNodeId,
      }));
    },

    async previewNodeDeletion(_input: RoadmapCanvasSessionInput, nodeId: string) {
      const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
      const nodeType = nodeTypeFor(roadmap, nodeId);
      const titleOf = (id: string) =>
        roadmap.nodes.find((candidate) => candidate.id === id)?.title ?? '';
      return {
        node: { title: node?.title ?? '', nodeType },
        dependencies: incidentDependencies(roadmap, nodeId).map(
          ({ id, sourceNodeId, targetNodeId }) => ({
            id,
            sourceTitle: titleOf(sourceNodeId),
            targetTitle: titleOf(targetNodeId),
          }),
        ),
        resources: (node ? nodeResources(node) : []).map(({ id, title }) => ({ id, title })),
        version: 'in-memory-preview',
      } satisfies NodeDeletionImpact;
    },

    async deleteNode(_input: RoadmapCanvasSessionInput, nodeId: string) {
      roadmap = {
        ...roadmap,
        nodes: roadmap.nodes.filter(({ id }) => id !== nodeId),
        dependencies: roadmap.dependencies.filter(
          ({ sourceNodeId, targetNodeId }) => sourceNodeId !== nodeId && targetNodeId !== nodeId,
        ),
      } as AnyRoadmapDto;
      simulation = null;
    },

    async addResource(_input: RoadmapCanvasSessionInput, nodeId: string, resource: ResourceInput) {
      const created: Resource = { ...resource, id: newResourceId(roadmap) };
      mutateNode(nodeId, (node) =>
        'resources' in node
          ? ({ ...node, resources: [...node.resources, created] } as AnyRoadmapDto['nodes'][number])
          : node,
      );
    },

    async uploadResource(_input: RoadmapCanvasSessionInput, nodeId: string, file: File) {
      const created: Resource = {
        id: newResourceId(roadmap),
        title: file.name,
        url: file.name,
        type: 'FILE',
      };
      mutateNode(nodeId, (node) =>
        'resources' in node
          ? ({ ...node, resources: [...node.resources, created] } as AnyRoadmapDto['nodes'][number])
          : node,
      );
    },

    async updateResource(
      _input: RoadmapCanvasSessionInput,
      resourceId: string,
      resource: ResourceInput,
    ) {
      roadmap = resourceUpdate(roadmap, resourceId, (current) => ({ ...current, ...resource }));
      simulation = null;
    },

    async deleteResource(_input: RoadmapCanvasSessionInput, resourceId: string) {
      roadmap = resourceUpdate(roadmap, resourceId, () => null);
      simulation = null;
    },

    async addNodeType(_input: RoadmapCanvasSessionInput, nodeType: RoadmapNodeTypeInput) {
      const id = `custom-${roadmap.nodeTypes.length + 1}`;
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
      roadmap = {
        ...roadmap,
        nodeTypes: roadmap.nodeTypes.map((current) =>
          current.id === nodeTypeId ? { ...current, ...nodeType } : current,
        ),
      };
    },

    async deleteNodeType(_input: RoadmapCanvasSessionInput, nodeTypeId: string) {
      roadmap = {
        ...roadmap,
        nodeTypes: roadmap.nodeTypes.filter(({ id }) => id !== nodeTypeId),
      } as AnyRoadmapDto;
    },

    async completeSimulatedNode(_input: RoadmapCanvasSessionInput, nodeId: string) {
      simulatedCompletions = new Set([...simulatedCompletions, nodeId]);
      refreshSimulation();
    },

    async resetSimulation() {
      simulatedCompletions = new Set();
      refreshSimulation();
    },
  };
}
