import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
import { roadmapUrl } from '@/features/roadmap/client';
import type { CanvasCommand, CanvasCommandOf } from '@/features/roadmap/canvas/commands/commands';
import type {
  AnyRoadmapDto,
  CourseOfferingIdentifier,
  StudentRoadmapDto,
} from '@/features/roadmap/types';
import type {
  PreviewImpactOf,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

type RouteRequest = {
  readonly method: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: object;
};

type Route<Kind extends CanvasCommand['kind']> = {
  /** One request, or one per item for a batch. */
  readonly requests: (command: CanvasCommandOf<Kind>) => RouteRequest | readonly RouteRequest[];
  readonly previewHeader?: string;
  readonly failure: string;
};

type PreviewRoute<Kind extends keyof PreviewImpactOf> = {
  readonly path: (command: CanvasCommandOf<Kind>) => string;
  readonly failure: string;
};

const nodeMove = ({ nodeId, position }: { nodeId: string; position: { x: number; y: number } }) =>
  ({
    method: 'PATCH',
    path: `/nodes/${nodeId}`,
    body: { positionX: position.x, positionY: position.y },
  }) as const;

const positionFailure = 'No se pudo guardar la posición.';
const visibilityFailure = 'No se pudo cambiar la visibilidad.';
const visibilityHeader = 'x-node-visibility-preview';

const routes: { readonly [Kind in CanvasCommand['kind']]: Route<Kind> } = {
  'add-node': {
    requests: ({ node, position }) => ({
      method: 'POST',
      path: '/nodes',
      body: {
        ...node,
        description: node.description || null,
        positionX: position.x,
        positionY: position.y,
      },
    }),
    failure: 'No se pudo crear el nodo.',
  },
  'update-node': {
    requests: ({ nodeId, value }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { ...value, description: value.description || null },
    }),
    failure: 'No se pudo guardar el nodo.',
  },
  'move-nodes': { requests: ({ positions }) => positions.map(nodeMove), failure: positionFailure },
  'apply-automatic-layout': {
    requests: ({ positions }) => positions.map(nodeMove),
    failure: positionFailure,
  },
  'create-dependency': {
    requests: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) => ({
      method: 'POST',
      path: '/dependencies',
      body: { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
    }),
    previewHeader: 'x-dependency-preview',
    failure: 'No se pudo crear la dependencia.',
  },
  'delete-dependencies': {
    requests: ({ dependencyIds }) =>
      dependencyIds.map((id) => ({ method: 'DELETE', path: `/dependencies/${id}` }) as const),
    failure: 'No se pudo eliminar la dependencia.',
  },
  'change-teacher-block': {
    requests: ({ nodeId, operation }) => ({
      method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
      path: `/nodes/${nodeId}/teacher-block`,
    }),
    previewHeader: 'x-teacher-block-preview',
    failure: 'No se pudo cambiar el bloqueo docente.',
  },
  'schedule-teacher-unlock': {
    requests: ({ nodeId, unlockOn }) => ({
      path: `/nodes/${nodeId}/teacher-block/schedule`,
      ...(unlockOn ? { method: 'PUT', body: { unlockOn } } : { method: 'DELETE' }),
    }),
    failure: 'No se pudo programar el desbloqueo.',
  },
  'hide-node': {
    requests: ({ nodeId }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { isVisible: false },
    }),
    previewHeader: visibilityHeader,
    failure: visibilityFailure,
  },
  'show-node': {
    requests: ({ nodeId }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { isVisible: true },
    }),
    previewHeader: visibilityHeader,
    failure: visibilityFailure,
  },
  'delete-node': {
    requests: ({ nodeId }) => ({ method: 'DELETE', path: `/nodes/${nodeId}` }),
    previewHeader: 'x-node-delete-preview',
    failure: 'No se pudo eliminar el nodo.',
  },
  'add-resource': {
    requests: ({ nodeId, resource }) => ({
      method: 'POST',
      path: `/nodes/${nodeId}/resources`,
      body: resource,
    }),
    failure: 'No se pudo agregar el recurso.',
  },
  'upload-resource': {
    requests: ({ nodeId, file }) => {
      const body = new FormData();
      body.append('file', file);
      return { method: 'POST', path: `/nodes/${nodeId}/resources`, body };
    },
    failure: 'No se pudo subir el archivo.',
  },
  'update-resource': {
    requests: ({ resourceId, resource }) => ({
      method: 'PATCH',
      path: `/resources/${resourceId}`,
      // A File resource keeps its protected download address: only its title is renamed.
      body: resource.type === 'FILE' ? { title: resource.title } : resource,
    }),
    failure: 'No se pudo guardar el recurso.',
  },
  'delete-resource': {
    requests: ({ resourceId }) => ({ method: 'DELETE', path: `/resources/${resourceId}` }),
    failure: 'No se pudo eliminar el recurso.',
  },
  'add-node-type': {
    requests: ({ nodeType }) => ({ method: 'POST', path: '/node-types', body: nodeType }),
    failure: 'No se pudo crear el tipo de nodo.',
  },
  'update-node-type': {
    requests: ({ nodeTypeId, nodeType }) => ({
      method: 'PATCH',
      path: `/node-types/${nodeTypeId}`,
      body: nodeType,
    }),
    failure: 'No se pudo guardar el tipo de nodo.',
  },
  'delete-node-type': {
    requests: ({ nodeTypeId }) => ({ method: 'DELETE', path: `/node-types/${nodeTypeId}` }),
    failure: 'No se pudo eliminar el tipo de nodo.',
  },
  'complete-node': {
    requests: ({ nodeId }) => ({ method: 'POST', path: `/nodes/${nodeId}/completion` }),
    failure: 'No se pudo completar el nodo.',
  },
  'complete-simulated-node': {
    requests: ({ nodeId }) => ({ method: 'POST', path: `/simulation/nodes/${nodeId}/completion` }),
    failure: 'No se pudo completar el nodo en la previsualización.',
  },
  'reset-canvas-preview': {
    requests: () => ({ method: 'DELETE', path: '/simulation' }),
    failure: 'No se pudo reiniciar el progreso de previsualización.',
  },
};

const previewRoutes: { readonly [Kind in keyof PreviewImpactOf]: PreviewRoute<Kind> } = {
  'hide-node': {
    path: ({ nodeId }) => `/nodes/${nodeId}?operation=HIDE`,
    failure: 'No se pudo calcular el impacto de ocultar el nodo.',
  },
  'delete-node': {
    path: ({ nodeId }) => `/nodes/${nodeId}?operation=DELETE`,
    failure: 'No se pudo calcular el impacto de eliminar el nodo.',
  },
  'change-teacher-block': {
    path: ({ nodeId, operation }) => `/nodes/${nodeId}/teacher-block?operation=${operation}`,
    failure: 'No se pudo calcular el impacto del bloqueo docente.',
  },
  'create-dependency': {
    path: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) =>
      `/dependencies?${new URLSearchParams({ sourceNodeId, targetNodeId, sourceHandle, targetHandle })}`,
    failure: 'No se pudo calcular el impacto de la dependencia.',
  },
};

async function failureError(response: Response, failure: string) {
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
    // Keep the user-facing failure message when a route has no JSON error body.
  }
  return new Error(failure);
}

function requestInit({ method, body }: RouteRequest, previewHeaders: Record<string, string>) {
  if (body instanceof FormData) return { method, body };
  if (body === undefined)
    return Object.keys(previewHeaders).length ? { method, headers: previewHeaders } : { method };
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...previewHeaders },
    body: JSON.stringify(body),
  };
}

export function createHttpRoadmapCanvasSessionPersistence(
  identifier: CourseOfferingIdentifier,
): RoadmapCanvasSessionPersistence {
  async function request(
    path: string,
    init: RequestInit,
    failure: string,
    isLoad = false,
  ): Promise<unknown> {
    const response = await fetch(roadmapUrl(identifier, path), init);
    if (!response.ok) {
      const error = await failureError(response, failure);
      if (isLoad && [401, 403, 404].includes(response.status))
        throw new RoadmapAccessLostError(error.message);
      throw error;
    }
    return response.status === 204 ? undefined : response.json();
  }

  const load = { cache: 'no-store' } as const;

  return {
    load: () => request('', load, 'No se pudo cargar el roadmap.', true) as Promise<AnyRoadmapDto>,

    loadCanvasPreview: () =>
      request(
        '/simulation',
        load,
        'No se pudo cargar la previsualización.',
      ) as Promise<StudentRoadmapDto>,

    preview(command) {
      const route = previewRoutes[command.kind] as PreviewRoute<typeof command.kind>;
      return request(route.path(command as never), {}, route.failure) as never;
    },

    async execute(command, previewVersion) {
      const route = routes[command.kind] as Route<typeof command.kind>;
      const previewHeaders =
        route.previewHeader && previewVersion ? { [route.previewHeader]: previewVersion } : {};
      const requests = route.requests(command as never);
      const sent = await Promise.allSettled(
        [requests]
          .flat()
          .map((item) => request(item.path, requestInit(item, previewHeaders), route.failure)),
      );
      const failed = sent.find((result) => result.status === 'rejected');
      if (failed) throw failed.reason;
      if (command.kind === 'add-node')
        return (sent[0] as PromiseFulfilledResult<{ node: { id: string } }>).value.node.id;
    },
  };
}
