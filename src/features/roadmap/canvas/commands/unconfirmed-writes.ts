import type {
  CanvasCommandOf,
  UnconfirmedCommand,
  UnconfirmedCommandKind,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

export type UnconfirmedWrite<Kind extends UnconfirmedCommandKind> = {
  write: (
    persistence: RoadmapCanvasSessionPersistence,
    command: CanvasCommandOf<Kind>,
  ) => Promise<string | void>;
  fallback: string;
  success?: (command: CanvasCommandOf<Kind>) => string;
  report?: (
    command: CanvasCommandOf<Kind>,
    createdNodeId: string | void,
  ) => PracticeCanvasAction | null;
  reloads?: 'canvas-preview';
};

const completionSuccess = () => 'Nodo completado.';
const execute = (persistence: RoadmapCanvasSessionPersistence, command: UnconfirmedCommand) =>
  persistence.execute(command);

export const unconfirmedWrites: { [Kind in UnconfirmedCommandKind]: UnconfirmedWrite<Kind> } = {
  'add-node': {
    write: execute,
    fallback: 'No se pudo crear el nodo.',
    success: () => 'Nodo creado exitosamente.',
    report: (_, nodeId) => (nodeId ? { type: 'addNode', nodeId } : null),
  },
  'update-node': {
    write: execute,
    fallback: 'No se pudo guardar el nodo.',
    success: () => 'Cambios guardados exitosamente.',
  },
  'move-nodes': {
    write: execute,
    fallback: 'No se pudo guardar la posición.',
  },
  'schedule-teacher-unlock': {
    write: execute,
    fallback: 'No se pudo programar el desbloqueo.',
    success: ({ unlockOn }) =>
      unlockOn ? 'Desbloqueo programado.' : 'Desbloqueo programado cancelado.',
  },
  'add-resource': {
    write: execute,
    fallback: 'No se pudo agregar el recurso.',
    success: () => 'Enlace guardado exitosamente.',
    report: ({ nodeId }) => ({ type: 'addResource', nodeId }),
  },
  'upload-resource': {
    write: execute,
    fallback: 'No se pudo subir el archivo.',
    success: () => 'Recurso guardado exitosamente.',
  },
  'update-resource': {
    write: execute,
    fallback: 'No se pudo guardar el recurso.',
    success: ({ resource }) =>
      resource.type === 'LINK' ? 'Enlace guardado exitosamente.' : 'Recurso guardado exitosamente.',
  },
  'delete-resource': {
    write: execute,
    fallback: 'No se pudo eliminar el recurso.',
    success: () => 'Recurso eliminado exitosamente.',
  },
  'add-node-type': {
    write: execute,
    fallback: 'No se pudo crear el tipo de nodo.',
    success: () => 'Tipo de nodo creado exitosamente.',
  },
  'update-node-type': {
    write: execute,
    fallback: 'No se pudo guardar el tipo de nodo.',
    success: () => 'Tipo de nodo guardado exitosamente.',
  },
  'complete-node': {
    write: execute,
    fallback: 'No se pudo completar el nodo.',
    success: completionSuccess,
  },
  'complete-simulated-node': {
    write: execute,
    fallback: 'No se pudo completar el nodo en la previsualización.',
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeSimulatedNode', nodeId }),
    reloads: 'canvas-preview',
  },
};
