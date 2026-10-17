import type {
  CanvasCommandOf,
  UnconfirmedCommandKind,
} from '@/features/roadmap/canvas/commands/commands';
import type {
  PracticeCanvasAction,
  RoadmapCanvasSessionInput,
  RoadmapCanvasSessionPersistence,
} from '@/features/roadmap/session/types';

/**
 * One canvas write that takes effect at once. It resolves the id of the Node it created,
 * if any. Afterwards the Roadmap reloads, or only the Canvas preview for a simulated write.
 */
export type UnconfirmedWrite<Kind extends UnconfirmedCommandKind> = {
  write: (
    persistence: RoadmapCanvasSessionPersistence,
    input: RoadmapCanvasSessionInput,
    command: CanvasCommandOf<Kind>,
  ) => Promise<string | void>;
  /** The session error when the write fails without a message of its own. */
  fallback: string;
  /** The toast shown once the write took effect. */
  success?: (command: CanvasCommandOf<Kind>) => string;
  /** What the Practice roadmap is told once the write took effect. */
  report?: (
    command: CanvasCommandOf<Kind>,
    createdNodeId: string | void,
  ) => PracticeCanvasAction | null;
  reloads?: 'canvas-preview';
};

/** Completing a Node in the Canvas preview shows the toast a student sees for a real Completion. */
const completionSuccess = () => 'Nodo completado.';

export const unconfirmedWrites: { [Kind in UnconfirmedCommandKind]: UnconfirmedWrite<Kind> } = {
  'add-node': {
    write: (persistence, input, { node, position }) => persistence.addNode(input, node, position),
    fallback: 'No se pudo crear el nodo.',
    success: () => 'Nodo creado exitosamente.',
    report: (_, nodeId) => (nodeId ? { type: 'addNode', nodeId } : null),
  },
  'update-node': {
    write: (persistence, input, { nodeId, value }) => persistence.updateNode(input, nodeId, value),
    fallback: 'No se pudo guardar el nodo.',
    success: () => 'Cambios guardados exitosamente.',
  },
  /** No toast: the dropped Node is its own feedback, and a failed move is the session error. */
  'move-nodes': {
    /** Each Node moves on its own, so a failed move keeps the others; it fails with the first. */
    write: async (persistence, input, { positions }) => {
      const moves = await Promise.allSettled(
        positions.map(({ nodeId, position }) => persistence.moveNode(input, nodeId, position)),
      );
      const failed = moves.find((move) => move.status === 'rejected');
      if (failed) throw failed.reason;
    },
    fallback: 'No se pudo guardar la posición.',
  },
  'schedule-teacher-unlock': {
    write: (persistence, input, { nodeId, unlockOn }) =>
      persistence.scheduleTeacherUnlock(input, nodeId, unlockOn),
    fallback: 'No se pudo programar el desbloqueo.',
    success: ({ unlockOn }) =>
      unlockOn ? 'Desbloqueo programado.' : 'Desbloqueo programado cancelado.',
  },
  'add-resource': {
    write: (persistence, input, { nodeId, resource }) =>
      persistence.addResource(input, nodeId, resource),
    fallback: 'No se pudo agregar el recurso.',
    success: () => 'Enlace guardado exitosamente.',
    report: ({ nodeId }) => ({ type: 'addResource', nodeId }),
  },
  'upload-resource': {
    write: (persistence, input, { nodeId, file }) =>
      persistence.uploadResource(input, nodeId, file),
    fallback: 'No se pudo subir el archivo.',
    success: () => 'Recurso guardado exitosamente.',
  },
  'update-resource': {
    write: (persistence, input, { resourceId, resource }) =>
      persistence.updateResource(input, resourceId, resource),
    fallback: 'No se pudo guardar el recurso.',
    success: ({ resource }) =>
      resource.type === 'LINK' ? 'Enlace guardado exitosamente.' : 'Recurso guardado exitosamente.',
  },
  'delete-resource': {
    write: (persistence, input, { resourceId }) => persistence.deleteResource(input, resourceId),
    fallback: 'No se pudo eliminar el recurso.',
    success: () => 'Recurso eliminado exitosamente.',
  },
  'add-node-type': {
    write: (persistence, input, { nodeType }) => persistence.addNodeType(input, nodeType),
    fallback: 'No se pudo crear el tipo de nodo.',
    success: () => 'Tipo de nodo creado exitosamente.',
  },
  'update-node-type': {
    write: (persistence, input, { nodeTypeId, nodeType }) =>
      persistence.updateNodeType(input, nodeTypeId, nodeType),
    fallback: 'No se pudo guardar el tipo de nodo.',
    success: () => 'Tipo de nodo guardado exitosamente.',
  },
  'complete-node': {
    write: (persistence, input, { nodeId }) => persistence.complete(input, nodeId),
    fallback: 'No se pudo completar el nodo.',
    success: completionSuccess,
  },
  'complete-simulated-node': {
    write: (persistence, input, { nodeId }) => persistence.completeSimulatedNode(input, nodeId),
    fallback: 'No se pudo completar el nodo en la previsualización.',
    success: completionSuccess,
    report: ({ nodeId }) => ({ type: 'completeSimulatedNode', nodeId }),
    reloads: 'canvas-preview',
  },
};
