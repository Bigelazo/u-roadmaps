import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
import { roadmapUrl } from '@/features/roadmap/client';
import type { Point } from '@/features/roadmap/graph/geometry';
import type { NodeUpdate } from '@/features/roadmap/editor/types';
import type {
  AnyRoadmapDto,
  DependencyImpact,
  NodeDeletionImpact,
  NodeHidingImpact,
  StudentRoadmapDto,
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

function previewHeader(name: string, previewVersion: string | undefined) {
  return previewVersion ? { headers: { [name]: previewVersion } } : {};
}

async function request<T = void>(
  input: RoadmapCanvasSessionInput,
  suffix: string,
  init: RequestInit,
  fallback: string,
): Promise<T> {
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
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const httpRoadmapCanvasSessionPersistence: RoadmapCanvasSessionPersistence = {
  load: (input) =>
    request<AnyRoadmapDto>(input, '', { cache: 'no-store' }, 'No se pudo cargar el roadmap.'),

  loadSimulation: (input) =>
    request<StudentRoadmapDto>(
      input,
      '/simulation',
      { cache: 'no-store' },
      'No se pudo cargar la previsualización.',
    ),

  async addNode(input, node: NewRoadmapNode, position: Point) {
    const { node: created } = await request<{ node: { id: string } }>(
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
    return created.id;
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

  previewRoadmapDependency: (input, { sourceNodeId, targetNodeId, sourceHandle, targetHandle }) =>
    request<DependencyImpact>(
      input,
      `/dependencies?${new URLSearchParams({ sourceNodeId, targetNodeId, sourceHandle, targetHandle })}`,
      {},
      'No se pudo calcular el impacto de la dependencia.',
    ),

  async connectNodes(
    input,
    { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
    previewVersion,
  ) {
    await request(
      input,
      '/dependencies',
      {
        method: 'POST',
        body: JSON.stringify({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }),
        ...previewHeader('x-dependency-preview', previewVersion),
      },
      'No se pudo crear la dependencia.',
    );
  },

  previewTeacherBlock: (input, nodeId, operation: TeacherBlockOperation) =>
    request<TeacherBlockPreview>(
      input,
      `/nodes/${nodeId}/teacher-block?operation=${operation}`,
      {},
      'No se pudo calcular el impacto del bloqueo docente.',
    ),

  async changeTeacherBlock(input, nodeId, operation, previewVersion) {
    await request(
      input,
      `/nodes/${nodeId}/teacher-block`,
      {
        method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
        ...previewHeader('x-teacher-block-preview', previewVersion),
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

  previewNodeHiding: (input, nodeId) =>
    request<NodeHidingImpact>(
      input,
      `/nodes/${nodeId}?operation=HIDE`,
      {},
      'No se pudo calcular el impacto de ocultar el nodo.',
    ),

  async setVisibility(input, nodeId, visible, previewVersion) {
    await request(
      input,
      `/nodes/${nodeId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ isVisible: visible }),
        ...previewHeader('x-node-visibility-preview', previewVersion),
      },
      'No se pudo cambiar la visibilidad.',
    );
  },

  previewNodeDeletion: (input, nodeId) =>
    request<NodeDeletionImpact>(
      input,
      `/nodes/${nodeId}?operation=DELETE`,
      {},
      'No se pudo calcular el impacto de eliminar el nodo.',
    ),

  async deleteNode(input, nodeId, previewVersion) {
    await request(
      input,
      `/nodes/${nodeId}`,
      {
        method: 'DELETE',
        ...previewHeader('x-node-delete-preview', previewVersion),
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
      {
        method: 'PATCH',
        body: JSON.stringify(resource.type === 'FILE' ? { title: resource.title } : resource),
      },
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
