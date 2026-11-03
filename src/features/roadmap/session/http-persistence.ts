import { RoadmapAccessLostError, RoadmapClosedError } from './access-lost';
import { roadmapUrl } from '@/features/roadmap/client';
import type {
  CanvasCommandOf,
  ChangeImpactCommand,
  PersistedCommand,
} from '@/features/roadmap/canvas/commands/commands';
import type { CourseOfferingIdentifier } from '@/features/roadmap/types';
import type { RoadmapCanvasSessionPersistence } from '@/features/roadmap/session/types';

type RouteRequest = {
  readonly method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: object;
};

type RequestOptions = {
  readonly previewHeader?: string;
  readonly previewVersion?: string;
  readonly load?: 'roadmap' | 'canvas-preview';
};

// Routes declare methods, so that one kind's route reads as a route for any command.
type Route<Kind extends PersistedCommand['kind']> = {
  /** One request, or one per Node for a batch of Node moves. */
  requests(command: CanvasCommandOf<Kind>): RouteRequest | readonly RouteRequest[];
  readonly previewHeader?: string;
  readonly failure: string;
};

type ChangeImpactRoute<Kind extends ChangeImpactCommand['kind']> = {
  path(command: CanvasCommandOf<Kind>): string;
  readonly failure: string;
};

const nodeMoves: Route<'move-nodes' | 'apply-automatic-layout'> = {
  requests: ({ positions }) =>
    positions.map(({ nodeId, position }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { positionX: position.x, positionY: position.y },
    })),
  failure: 'No se pudo guardar la posición.',
};

const visibilityFailure = 'No se pudo cambiar la visibilidad.';
const visibilityHeader = 'x-node-visibility-preview';

const routes: { readonly [Kind in PersistedCommand['kind']]: Route<Kind> } = {
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
  'move-nodes': nodeMoves,
  'apply-automatic-layout': nodeMoves,
  'create-dependency': {
    requests: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) => ({
      method: 'POST',
      path: '/dependencies',
      body: { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
    }),
    previewHeader: 'x-dependency-preview',
    failure: 'No se pudo crear la dependencia.',
  },
  'delete-dependency': {
    requests: ({ dependencyId }) => ({ method: 'DELETE', path: `/dependencies/${dependencyId}` }),
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
  'complete-canvas-preview-node': {
    requests: ({ nodeId }) => ({ method: 'POST', path: `/simulation/nodes/${nodeId}/completion` }),
    failure: 'No se pudo completar el nodo en la previsualización.',
  },
  'reset-canvas-preview': {
    requests: () => ({ method: 'DELETE', path: '/simulation' }),
    failure: 'No se pudo reiniciar el progreso de previsualización.',
  },
};

const changeImpactRoutes: {
  readonly [Kind in ChangeImpactCommand['kind']]: ChangeImpactRoute<Kind>;
} = {
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

export function createHttpRoadmapCanvasSessionPersistence(
  identifier: CourseOfferingIdentifier,
): RoadmapCanvasSessionPersistence {
  /** Sends one request; a denied Roadmap load means the access was lost. */
  async function request(
    { method, path, body }: RouteRequest,
    failure: string,
    { previewHeader, previewVersion, load }: RequestOptions = {},
  ) {
    const json = body !== undefined && !(body instanceof FormData);
    const headers = {
      ...(json && { 'Content-Type': 'application/json' }),
      ...(previewHeader && previewVersion ? { [previewHeader]: previewVersion } : {}),
    };
    const response = await fetch(roadmapUrl(identifier, path), {
      ...(method && { method }),
      ...(load && { cache: 'no-store' }),
      ...(Object.keys(headers).length > 0 && { headers }),
      ...(body && { body: json ? JSON.stringify(body) : body }),
    });
    if (!response.ok) {
      const error = await failureError(response, failure);
      if (load === 'roadmap' && [401, 403, 404].includes(response.status))
        throw new RoadmapAccessLostError(error.message);
      throw error;
    }
    return response;
  }

  return {
    load: async () =>
      (await request({ path: '' }, 'No se pudo cargar el roadmap.', { load: 'roadmap' })).json(),

    loadCanvasPreview: async () =>
      (
        await request({ path: '/simulation' }, 'No se pudo cargar la previsualización.', {
          load: 'canvas-preview',
        })
      ).json(),

    async readChangeImpact(command) {
      const route: ChangeImpactRoute<ChangeImpactCommand['kind']> =
        changeImpactRoutes[command.kind];
      return (await request({ path: route.path(command) }, route.failure)).json();
    },

    async execute(command, previewVersion) {
      const route: Route<PersistedCommand['kind']> = routes[command.kind];
      const options = { previewHeader: route.previewHeader, previewVersion };
      const sent = await Promise.allSettled(
        [route.requests(command)].flat().map((item) => request(item, route.failure, options)),
      );
      const responses = sent.map((result) => {
        if (result.status === 'rejected') throw result.reason;
        return result.value;
      });
      if (command.kind === 'add-node')
        return { createdNodeId: (await responses[0].json()).node.id };
    },
  };
}
