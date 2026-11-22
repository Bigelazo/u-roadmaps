import {
  chosenAutomaticLayout,
  teacherBlockScheduledUnlock,
  type CanvasCommand,
  type CanvasCommandKind,
  type CanvasCommandOf,
  type ChangeImpactCommand,
  type RoadmapNodePlacement,
  type ScheduledUnlock,
} from '@/features/roadmap/canvas/commands/canvas-command';
import type { ExecutionResult } from '@/features/roadmap/session/types';
import type { RoadmapDependency } from '@/features/roadmap/types';

export type RouteRequest = {
  readonly method?: 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly path: string;
  readonly body?: object;
};

type HttpCommand<Command extends { kind: string }> = {
  requests(command: Command): RouteRequest | readonly RouteRequest[];
  readonly failure: string;
  result?(responses: readonly Response[]): Promise<ExecutionResult>;
};

export type AnyHttpCommand = HttpCommand<CanvasCommand>;

export const changeImpactPath = (command: ChangeImpactCommand) =>
  `/change-impact?${new URLSearchParams(
    Object.entries(command).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string',
    ),
  )}`;

export const changeImpactFailures: Record<ChangeImpactCommand['kind'], string> = {
  'hide-node': 'No se pudo calcular el impacto de ocultar el nodo.',
  'delete-node': 'No se pudo calcular el impacto de eliminar el nodo.',
  'change-teacher-block': 'No se pudo calcular el impacto del bloqueo docente.',
  'create-dependency': 'No se pudo calcular el impacto de la dependencia.',
};

const scheduledUnlockRequest = ({
  nodeId,
  unlockAt,
  includeDependents,
}: ScheduledUnlock): RouteRequest => ({
  path: `/nodes/${nodeId}/teacher-block/schedule`,
  ...(unlockAt
    ? {
        method: 'PUT',
        body: includeDependents ? { unlockAt, includeDependents } : { unlockAt },
      }
    : { method: 'DELETE' }),
});

const nodeMoveRequests = (positions: readonly RoadmapNodePlacement[]): readonly RouteRequest[] =>
  positions.length ? [{ method: 'PATCH', path: '/placement', body: { positions } }] : [];

const nodeMoveFailure = 'No se pudo guardar la posición.';

const visibility = (isVisible: boolean) => ({
  requests: ({ nodeId }: { readonly nodeId: string }): RouteRequest => ({
    method: 'PATCH',
    path: `/nodes/${nodeId}`,
    body: { isVisible },
  }),
  failure: 'No se pudo cambiar la visibilidad.',
});

export const httpCommands: {
  [Kind in CanvasCommandKind]: HttpCommand<CanvasCommandOf<Kind>>;
} = {
  'hide-node': visibility(false),
  'show-node': visibility(true),
  'delete-node': {
    requests: ({ nodeId }) => ({ method: 'DELETE', path: `/nodes/${nodeId}` }),
    failure: 'No se pudo eliminar el nodo.',
  },
  'change-teacher-block': {
    requests: ({ nodeId, operation, schedule }) =>
      schedule
        ? scheduledUnlockRequest(teacherBlockScheduledUnlock(nodeId, operation, schedule))
        : {
            method: operation === 'BLOCK' ? 'POST' : operation === 'UNBLOCK' ? 'DELETE' : 'PATCH',
            path: `/nodes/${nodeId}/teacher-block`,
          },
    failure: 'No se pudo cambiar el bloqueo docente.',
  },
  'schedule-teacher-unlock': {
    requests: scheduledUnlockRequest,
    failure: 'No se pudo programar el desbloqueo.',
    result: async ([response]) => {
      const { title, scheduledPrerequisiteIds } = await response.json();
      return { scheduledUnlock: { title, prerequisites: scheduledPrerequisiteIds.length } };
    },
  },
  'create-dependency': {
    requests: ({ sourceNodeId, targetNodeId, sourceHandle, targetHandle }) => ({
      method: 'POST',
      path: '/dependencies',
      body: { sourceNodeId, targetNodeId, sourceHandle, targetHandle },
    }),
    failure: 'No se pudo crear la dependencia.',
    result: async ([response]) => {
      const { dependency, nodes }: { dependency: RoadmapDependency; nodes: { id: string }[] } =
        await response.json();
      return { dependency, teacherBlockedNodeIds: nodes.map(({ id }) => id) };
    },
  },
  'delete-dependencies': {
    requests: ({ dependencyIds }) => ({
      method: 'DELETE',
      path: '/dependencies',
      body: { dependencyIds },
    }),
    failure: 'No se pudo eliminar la dependencia.',
  },
  'move-nodes': {
    requests: ({ positions }) => nodeMoveRequests(positions),
    failure: nodeMoveFailure,
  },
  'apply-automatic-layout': {
    requests: (layout) => nodeMoveRequests(chosenAutomaticLayout(layout)),
    failure: nodeMoveFailure,
  },
  'add-node': {
    requests: ({ nodeId, node, position, displaced }) => ({
      method: 'POST',
      path: '/nodes',
      body: {
        nodeId,
        ...node,
        description: node.description || null,
        positionX: position.x,
        positionY: position.y,
        displaced,
      },
    }),
    failure: 'No se pudo crear el nodo.',
    result: async ([response]) => ({ createdNodeId: (await response.json()).node.id }),
  },
  'update-node': {
    requests: ({ nodeId, value }) => ({
      method: 'PATCH',
      path: `/nodes/${nodeId}`,
      body: { ...value, description: value.description || null },
    }),
    failure: 'No se pudo guardar el nodo.',
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
    requests: ({ resourceId, resource, file }) => {
      const path = `/resources/${resourceId}`;
      if (!file)
        return {
          method: 'PATCH',
          path,
          body: resource.type === 'FILE' ? { title: resource.title } : resource,
        };
      const body = new FormData();
      body.append('title', resource.title);
      body.append('file', file);
      return { method: 'PATCH', path, body };
    },
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
