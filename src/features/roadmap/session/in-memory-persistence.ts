import type { Point } from '@/features/roadmap/graph/geometry';
import {
  transitiveDependentNodeIds,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
import type {
  AnyRoadmapDto,
  NodeDeletionImpact,
  Resource,
  RoadmapDependency,
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

function asSimulation(roadmap: AnyRoadmapDto): StudentRoadmapDto {
  if (roadmap.nodes.every((node) => 'access' in node)) return copy(roadmap as StudentRoadmapDto);
  const nodes = roadmap.nodes.reduce<StudentRoadmapNode[]>((result, node) => {
    if (!('isVisible' in node) || !node.isVisible) return result;
    if (node.isTeacherBlocked) {
      result.push({
        id: node.id,
        title: node.title,
        nodeTypeId: node.nodeTypeId,
        positionX: node.positionX,
        positionY: node.positionY,
        access: { status: 'BLOCKED', reason: 'TEACHER_BLOCK' },
      });
      return result;
    }
    result.push({
      id: node.id,
      title: node.title,
      nodeTypeId: node.nodeTypeId,
      positionX: node.positionX,
      positionY: node.positionY,
      isVisible: true,
      access: { status: 'ACCESSIBLE' },
      description: node.description,
      isCompleted: false,
      canComplete: true,
      resources: copy(node.resources),
    });
    return result;
  }, []);
  return {
    course: copy(roadmap.course),
    courseOffering: copy(roadmap.courseOffering),
    roadmap: copy(roadmap.roadmap),
    nodeTypes: copy(roadmap.nodeTypes),
    nodes,
    dependencies: copy(roadmap.dependencies),
  };
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

/** Test adapter for the public Roadmap canvas session seam. */
export function createInMemoryRoadmapSessionPersistence(
  initialRoadmap: AnyRoadmapDto,
): RoadmapCanvasSessionPersistence {
  let roadmap = copy(initialRoadmap);
  let simulation: StudentRoadmapDto | null = null;
  let nextNodeNumber = roadmap.nodes.length + 1;

  const refreshSimulation = () => {
    simulation = asSimulation(roadmap);
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
      return copy(roadmap);
    },

    async complete(_input: RoadmapCanvasSessionInput, nodeId: string) {
      roadmap = replaceRoadmapNode(roadmap, nodeId, (node) =>
        'isCompleted' in node ? { ...node, isCompleted: true, canComplete: false } : node,
      );
    },

    async loadSimulation() {
      if (!simulation) refreshSimulation();
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
      const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
      return {
        mode: operation === 'BLOCK' ? 'BLOCK' : 'SINGLE',
        nodes: node ? [{ id: node.id, title: node.title, relation: 'SELECTED_NODE' }] : [],
        version: 'in-memory-preview',
      } as TeacherBlockPreview;
    },

    async changeTeacherBlock(
      _input: RoadmapCanvasSessionInput,
      nodeId: string,
      operation: TeacherBlockOperation,
    ) {
      mutateNode(nodeId, (node) =>
        'isTeacherBlocked' in node
          ? ({ ...node, isTeacherBlocked: operation === 'BLOCK' } as AnyRoadmapDto['nodes'][number])
          : node,
      );
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
      mutateNode(nodeId, (node) =>
        'isVisible' in node
          ? ({ ...node, isVisible: !isVisible } as AnyRoadmapDto['nodes'][number])
          : node,
      );
    },

    async previewNodeVisibility() {
      return [];
    },

    async previewNodeDeletion(_input: RoadmapCanvasSessionInput, nodeId: string) {
      const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
      const nodeType = nodeTypeFor(roadmap, nodeId);
      return {
        node: { title: node?.title ?? '', nodeType },
        dependencies: [],
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
      if (!simulation) refreshSimulation();
      simulation = {
        ...simulation!,
        nodes: simulation!.nodes.map((node) =>
          node.id === nodeId && 'isCompleted' in node
            ? { ...node, isCompleted: true, canComplete: false }
            : node,
        ),
      };
    },

    async resetSimulation() {
      refreshSimulation();
    },
  };
}
