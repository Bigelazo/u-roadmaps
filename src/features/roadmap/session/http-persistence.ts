import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
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

async function failureError(response: Response, fallback: string) {
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
      return 'code' in body.error && body.error.code === 'ROADMAP_CLOSED'
        ? new RoadmapClosedError(body.error.message)
        : new Error(body.error.message);
    }
  } catch {
    // Keep the user-facing fallback when an existing route has no JSON error body.
  }
  return new Error(fallback);
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

function isTitledRecord(value: unknown): value is TeacherBlockImpact {
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

function isTeacherBlockPreview(value: unknown): value is TeacherBlockPreview {
  return (
    isRecord(value) &&
    typeof value.version === 'string' &&
    Array.isArray(value.nodes) &&
    value.nodes.every(isTitledRecord)
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
    value.resources.every(isTitledRecord)
  );
}

function isDependencyPreview(value: unknown): value is { nodes: TeacherBlockImpact[] } {
  return isRecord(value) && Array.isArray(value.nodes) && value.nodes.every(isTitledRecord);
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
  if (!response.ok) {
    const error = await failureError(response, fallback);
    if (!suffix && [401, 403, 404].includes(response.status))
      throw new RoadmapAccessLostError(error.message);
    throw error;
  }
  if (response.status === 204) return undefined;
  return response.json();
}

/** Reads a JSON body and rejects with the fallback message when it has an unexpected shape. */
async function fetchValid<T>(
  input: RoadmapCanvasSessionInput,
  suffix: string,
  init: RequestInit,
  isValid: (body: unknown) => body is T,
  fallback: string,
) {
  const body: unknown = await request(input, suffix, init, fallback);
  if (!isValid(body)) throw new Error(fallback);
  return body;
}

export const httpRoadmapCanvasSessionPersistence: RoadmapCanvasSessionPersistence = {
  load: (input) =>
    fetchValid<AnyRoadmapDto>(
      input,
      '',
      { cache: 'no-store' },
      input.experience.kind === 'teaching' ? isTeachingRoadmap : isStudentRoadmap,
      'No se pudo cargar el roadmap.',
    ),

  loadSimulation: (input) =>
    fetchValid(
      input,
      '/simulation',
      { cache: 'no-store' },
      isStudentRoadmap,
      'No se pudo cargar la previsualización.',
    ),

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
    await request(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ ...node, description: node.description || null }) },
      'No se pudo guardar el nodo.',
    );
  },

  async moveNode(input, nodeId: string, position: Point) {
    await request(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ positionX: position.x, positionY: position.y }) },
      'No se pudo guardar la posición.',
    );
  },

  async connectNodes(input, sourceNodeId, targetNodeId, sourceHandle, targetHandle) {
    await request(
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
    const body = await fetchValid(
      input,
      `/dependencies?${query}`,
      {},
      isDependencyPreview,
      'No se pudo calcular el impacto de la dependencia.',
    );
    return body.nodes;
  },

  previewTeacherBlock: (input, nodeId, operation: TeacherBlockOperation) =>
    fetchValid(
      input,
      `/nodes/${nodeId}/teacher-block?operation=${operation}`,
      {},
      isTeacherBlockPreview,
      'No se pudo calcular el impacto del bloqueo docente.',
    ),

  async changeTeacherBlock(input, nodeId, operation, previewVersion) {
    await request(
      input,
      `/nodes/${nodeId}/teacher-block`,
      {
        method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
        ...(previewVersion ? { headers: { 'x-teacher-block-preview': previewVersion } } : {}),
      },
      'No se pudo cambiar el bloqueo docente.',
    );
  },

  async scheduleTeacherUnlock(input, nodeId, unlockOn) {
    await request(
      input,
      `/nodes/${nodeId}/teacher-block/schedule`,
      unlockOn
        ? {
            method: 'PUT',
            body: JSON.stringify({ unlockOn }),
          }
        : { method: 'DELETE' },
      'No se pudo programar el desbloqueo.',
    );
  },

  async deleteDependency(input, dependencyId) {
    await request(
      input,
      `/dependencies/${dependencyId}`,
      { method: 'DELETE' },
      'No se pudo eliminar la dependencia.',
    );
  },

  async toggleVisibility(input, nodeId, isVisible) {
    await request(
      input,
      `/nodes/${nodeId}`,
      { method: 'PATCH', body: JSON.stringify({ isVisible: !isVisible }) },
      'No se pudo cambiar la visibilidad.',
    );
  },

  async previewNodeVisibility(input, nodeId) {
    const body = await fetchValid(
      input,
      `/nodes/${nodeId}?operation=HIDE`,
      {},
      isVisibilityPreview,
      'No se pudo calcular el impacto de ocultar el nodo.',
    );
    return body.dependencies;
  },

  previewNodeDeletion: (input, nodeId) =>
    fetchValid(
      input,
      `/nodes/${nodeId}?operation=DELETE`,
      {},
      isNodeDeletionImpact,
      'No se pudo calcular el impacto de eliminar el nodo.',
    ),

  async deleteNode(input, nodeId, previewVersion) {
    await request(
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
    await request(
      input,
      `/nodes/${nodeId}/resources`,
      { method: 'POST', body: JSON.stringify(resource) },
      'No se pudo agregar el recurso.',
    );
  },

  async uploadResource(input, nodeId, file) {
    const body = new FormData();
    body.append('file', file);
    await request(
      input,
      `/nodes/${nodeId}/resources`,
      { method: 'POST', body },
      'No se pudo subir el archivo.',
    );
  },

  async updateResource(input, resourceId, resource) {
    await request(
      input,
      `/resources/${resourceId}`,
      { method: 'PATCH', body: JSON.stringify(resource) },
      'No se pudo guardar el recurso.',
    );
  },

  async deleteResource(input, resourceId) {
    await request(
      input,
      `/resources/${resourceId}`,
      { method: 'DELETE' },
      'No se pudo eliminar el recurso.',
    );
  },

  async addNodeType(input, nodeType: RoadmapNodeTypeInput) {
    await request(
      input,
      '/node-types',
      { method: 'POST', body: JSON.stringify(nodeType) },
      'No se pudo crear el tipo de nodo.',
    );
  },

  async updateNodeType(input, nodeTypeId, nodeType) {
    await request(
      input,
      `/node-types/${nodeTypeId}`,
      { method: 'PATCH', body: JSON.stringify(nodeType) },
      'No se pudo guardar el tipo de nodo.',
    );
  },

  async deleteNodeType(input, nodeTypeId) {
    await request(
      input,
      `/node-types/${nodeTypeId}`,
      { method: 'DELETE' },
      'No se pudo eliminar el tipo de nodo.',
    );
  },

  async complete(input, nodeId) {
    await request(
      input,
      `/nodes/${nodeId}/completion`,
      { method: 'POST' },
      'No se pudo completar el nodo.',
    );
  },

  async completeSimulatedNode(input, nodeId) {
    await request(
      input,
      `/simulation/nodes/${nodeId}/completion`,
      { method: 'POST' },
      'No se pudo completar el nodo en la previsualización.',
    );
  },

  async resetSimulation(input) {
    await request(
      input,
      '/simulation',
      { method: 'DELETE' },
      'No se pudo reiniciar el progreso de previsualización.',
    );
  },
};
