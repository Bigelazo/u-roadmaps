import { roadmapUrl } from '@/features/roadmap/client';
import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeUpdate } from '@/features/roadmap/editor/types';
import type {
  AnyRoadmapDto,
  NodeDeletionImpact,
  RoadmapDto,
  StudentRoadmapDto,
  TeacherBlockImpact,
  TeacherBlockOperation,
  TeacherBlockPreview,
} from '@/features/roadmap/types';
import type {
  NewRoadmapNode,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
  RoadmapNodeTypeInput,
} from '@/features/roadmap/session/types';

async function failureMessage(response: Response, fallback: string) {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'object' &&
      body.error !== null &&
      'message' in body.error &&
      typeof body.error.message === 'string'
    ) {
      return body.error.message;
    }
  } catch {
    // Keep the user-facing fallback when an existing route has no JSON error body.
  }
  return fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRoadmap(value: unknown): value is AnyRoadmapDto {
  return (
    isRecord(value) &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.nodeTypes) &&
    value.nodes.every(
      (node) =>
        isRecord(node) && ('access' in node || ('isVisible' in node && 'isTeacherBlocked' in node)),
    )
  );
}

function isStudentRoadmap(value: unknown): value is StudentRoadmapDto {
  return isRoadmap(value) && value.nodes.every((node) => isRecord(node) && 'access' in node);
}

function isTeachingRoadmap(value: unknown): value is RoadmapDto {
  return (
    isRoadmap(value) &&
    value.nodes.every(
      (node) =>
        isRecord(node) &&
        'isVisible' in node &&
        typeof node.isVisible === 'boolean' &&
        'isTeacherBlocked' in node &&
        typeof node.isTeacherBlocked === 'boolean',
    )
  );
}

function isTeacherBlockImpact(value: unknown): value is TeacherBlockImpact {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string';
}

function isDeletionDependency(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.sourceTitle === 'string' &&
    typeof value.targetTitle === 'string'
  );
}

function isDeletionResource(value: unknown) {
  return isRecord(value) && typeof value.id === 'string' && typeof value.title === 'string';
}

function isTeacherBlockPreview(value: unknown): value is TeacherBlockPreview {
  return (
    isRecord(value) &&
    typeof value.version === 'string' &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isTeacherBlockImpact)
  );
}

function isNodeDeletionImpact(value: unknown): value is NodeDeletionImpact {
  if (!isRecord(value) || typeof value.version !== 'string') return false;
  const node = value.node;
  return (
    isRecord(node) &&
    typeof node.title === 'string' &&
    isRecord(node.nodeType) &&
    typeof node.nodeType.name === 'string' &&
    typeof node.nodeType.icon === 'string' &&
    typeof node.nodeType.color === 'string' &&
    Array.isArray(value.dependencies) &&
    value.dependencies.every(isDeletionDependency) &&
    Array.isArray(value.resources) &&
    value.resources.every(isDeletionResource)
  );
}

function isVisibilityPreview(value: unknown): value is {
  dependencies: { id: string; sourceNodeId: string; targetNodeId: string }[];
} {
  return (
    isRecord(value) &&
    Array.isArray(value.dependencies) &&
    value.dependencies.every(
      (dependency) =>
        isRecord(dependency) &&
        typeof dependency.id === 'string' &&
        typeof dependency.sourceNodeId === 'string' &&
        typeof dependency.targetNodeId === 'string',
    )
  );
}

async function request(
  input: RoadmapCanvasSessionInput,
  suffix: string,
  init: RequestInit,
  fallback: string,
) {
  const headers =
    init.body instanceof FormData || init.body === undefined
      ? init.headers
      : { 'Content-Type': 'application/json', ...(init.headers ?? {}) };
  const response = await fetch(
    roadmapUrl(input.courseOffering.identifier, suffix),
    headers === undefined ? init : { ...init, headers },
  );
  if (!response.ok) throw new Error(await failureMessage(response, fallback));
  if (response.status === 204) return undefined;
  return response.json();
}

async function mutate(
  input: RoadmapCanvasSessionInput,
  suffix: string,
  init: RequestInit,
  fallback: string,
) {
  await request(input, suffix, init, fallback);
}

export const httpRoadmapCanvasSessionPersistence: RoadmapCanvasSessionPersistence = {
  async load(input) {
    const body = await request(input, '', {}, 'No se pudo cargar el roadmap.');
    const validProjection =
      input.experience.kind === 'teaching' ? isTeachingRoadmap(body) : isStudentRoadmap(body);
    if (!validProjection) throw new Error('No se pudo cargar el roadmap.');
    return body;
  },

  async loadSimulation(input) {
    const body = await request(input, '/simulation', {}, 'No se pudo cargar la previsualización.');
    if (!isStudentRoadmap(body)) throw new Error('No se pudo cargar la previsualización.');
    return body;
  },

  async addNode(input, node: NewRoadmapNode, position: Point) {
    const body = await request(
      input,
      '/nodes',
      {
        method: 'POST',
        body: JSON.stringify({
          ...node,
          description: node.description || null,
          positionX: position.x,
          positionY: position.y,
        }),
      },
      'No se pudo crear el nodo.',
    );
    return isRecord(body) && isRecord(body.node) && typeof body.node.id === 'string'
      ? body.node.id
      : undefined;
  },

  async updateNode(input, nodeId: string, node: NodeUpdate) {
    await mutate(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ ...node, description: node.description || null }) },
      'No se pudo guardar el nodo.',
    );
  },

  async moveNode(input, nodeId: string, position: Point) {
    await mutate(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ positionX: position.x, positionY: position.y }) },
      'No se pudo guardar la posición.',
    );
  },

  async connectNodes(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle) {
    await mutate(
      input,
      '/dependencies',
      {
        method: 'POST',
        body: JSON.stringify({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }),
      },
      'No se pudo crear la dependencia.',
    );
  },

  async previewRoadmapDependency(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle) {
    const query = new URLSearchParams({ sourceNodeId, targetNodeId });
    if (sourceHandle) query.set('sourceHandle', sourceHandle);
    if (targetHandle) query.set('targetHandle', targetHandle);
    const body = await request(
      input,
      `/dependencies?${query}`,
      {},
      'No se pudo calcular el impacto de la dependencia.',
    );
    if (!isRecord(body) || !Array.isArray(body.nodes) || !body.nodes.every(isTeacherBlockImpact)) {
      throw new Error('No se pudo calcular el impacto de la dependencia.');
    }
    return body.nodes;
  },

  async previewTeacherBlock(input, nodeId, operation: TeacherBlockOperation) {
    const body = await request(
      input,
      `/nodes/${nodeId}/teacher-block?operation=${operation}`,
      {},
      'No se pudo calcular el impacto del bloqueo docente.',
    );
    if (!isTeacherBlockPreview(body)) {
      throw new Error('No se pudo calcular el impacto del bloqueo docente.');
    }
    return body;
  },

  async changeTeacherBlock(input, nodeId, operation, previewVersion) {
    await mutate(
      input,
      `/nodes/${nodeId}/teacher-block`,
      {
        method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
        ...(previewVersion ? { headers: { 'x-teacher-block-preview': previewVersion } } : {}),
      },
      'No se pudo cambiar el bloqueo docente.',
    );
  },

  async deleteDependency(input, dependencyId) {
    await mutate(
      input,
      `/dependencies/${dependencyId}`,
      { method: 'DELETE' },
      'No se pudo eliminar la dependencia.',
    );
  },

  async toggleVisibility(input, nodeId, isVisible) {
    await mutate(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ isVisible: !isVisible }) },
      'No se pudo cambiar la visibilidad.',
    );
  },

  async previewNodeVisibility(input, nodeId) {
    const body = await request(
      input,
      `/nodes/${nodeId}?operation=HIDE`,
      {},
      'No se pudo calcular el impacto de ocultar el nodo.',
    );
    if (!isVisibilityPreview(body))
      throw new Error('No se pudo calcular el impacto de ocultar el nodo.');
    return body.dependencies;
  },

  async previewNodeDeletion(input, nodeId) {
    const body = await request(
      input,
      `/nodes/${nodeId}?operation=DELETE`,
      {},
      'No se pudo calcular el impacto de eliminar el nodo.',
    );
    if (!isNodeDeletionImpact(body))
      throw new Error('No se pudo calcular el impacto de eliminar el nodo.');
    return body;
  },

  async deleteNode(input, nodeId, previewVersion) {
    await mutate(
      input,
      `/nodes/${nodeId}`,
      {
        method: 'DELETE',
        ...(previewVersion ? { headers: { 'x-node-delete-preview': previewVersion } } : {}),
      },
      'No se pudo eliminar el nodo.',
    );
  },

  async addResource(input, nodeId, resource) {
    await mutate(
      input,
      `/nodes/${nodeId}/resources`,
      { method: 'POST', body: JSON.stringify(resource) },
      'No se pudo agregar el recurso.',
    );
  },

  async uploadResource(input, nodeId, file) {
    const body = new FormData();
    body.append('file', file);
    await mutate(
      input,
      `/nodes/${nodeId}/resources`,
      { method: 'POST', body },
      'No se pudo subir el archivo.',
    );
  },

  async updateResource(input, resourceId, resource) {
    await mutate(
      input,
      `/resources/${resourceId}`,
      { method: 'PATCH', body: JSON.stringify(resource) },
      'No se pudo guardar el recurso.',
    );
  },

  async deleteResource(input, resourceId) {
    await mutate(
      input,
      `/resources/${resourceId}`,
      { method: 'DELETE' },
      'No se pudo eliminar el recurso.',
    );
  },

  async addNodeType(input, nodeType: RoadmapNodeTypeInput) {
    await mutate(
      input,
      '/node-types',
      { method: 'POST', body: JSON.stringify(nodeType) },
      'No se pudo crear el tipo de nodo.',
    );
  },

  async updateNodeType(input, nodeTypeId, nodeType) {
    await mutate(
      input,
      `/node-types/${nodeTypeId}`,
      { method: 'PATCH', body: JSON.stringify(nodeType) },
      'No se pudo guardar el tipo de nodo.',
    );
  },

  async deleteNodeType(input, nodeTypeId) {
    await mutate(
      input,
      `/node-types/${nodeTypeId}`,
      { method: 'DELETE' },
      'No se pudo eliminar el tipo de nodo.',
    );
  },

  async complete(input, nodeId) {
    await mutate(
      input,
      `/nodes/${nodeId}/completion`,
      { method: 'POST' },
      'No se pudo completar el nodo.',
    );
  },

  async completeSimulatedNode(input, nodeId) {
    await mutate(
      input,
      `/simulation/nodes/${nodeId}/completion`,
      { method: 'POST' },
      'No se pudo completar el nodo en la previsualización.',
    );
  },

  async resetSimulation(input) {
    await mutate(
      input,
      '/simulation',
      { method: 'DELETE' },
      'No se pudo reiniciar el progreso de previsualización.',
    );
  },
};
