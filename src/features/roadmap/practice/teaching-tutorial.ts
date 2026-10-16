import { clickElement, waitForElement, type TutorialStep } from '@/shared/client/tutorial/tutorial';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { NODE_TYPES_MENU_ITEM_LABEL } from '@/features/roadmap/editor/types';
import { practiceNodeIds } from './practice-roadmap';
import { canvas, nodeSelector, nodeTypeAndResourcesStep } from './student-tutorial';

/** "Crear en el mapa", its menu while open, or the creation dialog while open. */
function nodeCreator() {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) =>
    candidate.textContent?.includes('Agregar al mapa'),
  );
  const layer = document.querySelector('button[aria-label="Crear en el mapa"]')?.parentElement;
  return dialog ?? layer?.querySelector('[role="menu"]') ?? layer ?? null;
}

/** Keeps action confirmations clear of the tutorial popover after the canvas resizes. */
function confirmationOrCanvas() {
  return (
    document.querySelector('[role="alertdialog"]:not(.u-roadmaps-tour-exit)') ??
    document.querySelector(canvas)
  );
}

/** Follows the requested Node's block control into its action menu and confirmation. */
function branchBlockControl() {
  const confirmation = document.querySelector('[role="alertdialog"]:not(.u-roadmaps-tour-exit)');
  const menu = document.getElementById(`node-actions-${practiceNodeIds.b}`);
  const blockAction = menu
    ? [...menu.querySelectorAll('button')].find(
        (button) =>
          button.getAttribute('aria-label') === 'Bloquear nodo' ||
          button.textContent?.trim() === 'Bloquear nodo',
      )
    : null;
  const node = document.querySelector(nodeSelector(practiceNodeIds.b));
  return (
    confirmation ??
    blockAction ??
    node?.querySelector('button[aria-label="Abrir menú de acciones del nodo"]') ??
    node
  );
}

/** Keeps the requested Node highlighted, then follows its menu and confirmation. */
function nodeControlOrConfirmation(nodeId: string) {
  return () =>
    document.querySelector('[role="alertdialog"]:not(.u-roadmaps-tour-exit)') ??
    document.getElementById(`node-actions-${nodeId}`) ??
    document.querySelector(nodeSelector(nodeId));
}

/** The open Node detail in "Vista estudiante", or the given Node. */
function nodeDetailOr(nodeId: string) {
  return () =>
    document.querySelector('[aria-labelledby="student-node-detail-title"]') ??
    document.querySelector(nodeSelector(nodeId));
}

/**
 * The teaching Roadmap tutorial on the Practice roadmap. Action steps advance only when
 * the canvas reports their action took effect. Built per run: it remembers the new Node.
 */
export function teachingTutorialSteps(): readonly TutorialStep<PracticeCanvasAction>[] {
  let createdNodeId: string | null = null;
  return [
    {
      element: 'button[aria-label="Centrar mapa"]',
      title: 'Centrar roadmap',
      description:
        'Puedes arrastrar el fondo para desplazarte, y usar la rueda del mouse para acercar o alejar. Presiona este botón para centrar la vista en el roadmap completo',
      advanceWhen: (action) => action.type === 'fitView',
      allowManualAdvance: true,
    },
    nodeTypeAndResourcesStep,
    {
      element: nodeSelector(practiceNodeIds.h),
      title: 'Nodo oculto',
      description:
        'Esta representación marca un nodo que está oculto para estudiantes: solo el equipo docente puede verlo.',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Nodo bloqueado',
      description:
        'Esta representación marca un nodo bloqueado por el equipo docente. Los estudiantes pueden verlo en el roadmap, pero no pueden acceder a él hasta que lo liberes.',
    },
    {
      element: nodeCreator,
      title: 'Crea un nodo',
      description:
        'Presiona el botón flotante y elige "Crear nodo". Escribe un título, elige el tipo y déjalo visible para estudiantes. La descripción es compatible con Markdown, y puedes arrastrar un archivo .md a la descripción.',
      side: 'top',
      advanceWhen: (action) => {
        if (action.type !== 'addNode') return false;
        createdNodeId = action.nodeId;
        return true;
      },
    },
    {
      // The "Tipos de nodo" item while its menu is open, otherwise "Crear en el mapa".
      element: () =>
        document.querySelector(`[aria-label="${NODE_TYPES_MENU_ITEM_LABEL}"]`) ??
        document.querySelector('button[aria-label="Crear en el mapa"]'),
      title: 'Tipos de nodo',
      description:
        'En el menú de "Crear en el mapa", la opción "Tipos de nodo" te permite crear tus propios tipos, con su nombre, ícono y color.',
      side: 'top',
    },
    {
      element: canvas,
      title: 'Conecta tu nodo',
      description:
        'Arrastra desde uno de los 4 puntos de tu nuevo nodo hasta uno de los 4 puntos del nodo "Control 1" para crear una dependencia.',
      advanceWhen: (action) =>
        action.type === 'connectNodes' &&
        action.sourceNodeId === createdNodeId &&
        action.targetNodeId === practiceNodeIds.e,
    },
    {
      element: nodeSelector(practiceNodeIds.e),
      title: 'Dependencias',
      highlightElements: () => {
        const selectors = [
          nodeSelector(practiceNodeIds.e),
          ...(createdNodeId
            ? [
                nodeSelector(createdNodeId),
                `.react-flow__edge[aria-label="Edge from ${createdNodeId} to ${practiceNodeIds.e}"]`,
              ]
            : []),
        ];
        return selectors.flatMap((selector) => {
          const element = document.querySelector(selector);
          return element ? [element] : [];
        });
      },
      description:
        'Tu nodo ahora es un prerrequisito del nodo "Control 1": un nodo permanecerá automáticamente bloqueado para estudiantes hasta que complete todos sus prerrequisitos. Para borrar una dependencia, puedes seleccionarla y pulsar el botón de eliminar.',
    },
    {
      element: canvas,
      title: 'Selecciona tu nodo',
      description: 'Haz clic en el nodo que creaste para editarlo.',
      advanceWhen: (action) => action.type === 'selectNode' && action.nodeId === createdNodeId,
    },
    {
      element: '#roadmap-editor-panel [data-slot="sidebar-content"]',
      allowInteraction: true,
      title: 'Editor de nodo',
      description:
        'Aquí puedes cambiar múltiples propiedades del nodo, como su título, descripción, tipo, recursos, bloquear, ocultar, etc.',
      side: 'left',
    },
    {
      element: branchBlockControl,
      title: 'Bloquea un nodo',
      prepare: () => clickElement(nodeSelector(practiceNodeIds.b)),
      description:
        'En el nodo "Conceptos básicos" abre su menú de acciones y elige "Bloquear nodo". El bloqueo también se propagará a todos los nodos dependientes del seleccionado.',
      advanceWhen: (action) =>
        action.type === 'changeTeacherBlock' &&
        action.nodeId === practiceNodeIds.b &&
        action.operation === 'BLOCK',
    },
    {
      element: canvas,
      title: 'Bloqueo propagado',
      description:
        'En este caso, el bloqueo se propagó a los nodos dependientes de "Conceptos básicos": "Ejercicios guiados", "Control 1", "Proyecto final" y "Retroalimentación del control".',
    },
    {
      element: nodeControlOrConfirmation(practiceNodeIds.b),
      title: 'Desbloquea el nodo',
      description:
        'Abre otra vez el menú de acciones del nodo "Conceptos básicos" y desbloquéalo. Puedes elegir entre desbloquear solo este nodo, o incluir además a los dependientes de él.',
      advanceWhen: (action) =>
        action.type === 'changeTeacherBlock' &&
        action.nodeId === practiceNodeIds.b &&
        action.operation !== 'BLOCK',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Desbloqueo programado',
      prepare: async () => {
        clickElement('#roadmap-editor-panel button[aria-label="Deseleccionar nodo"]');
        await waitForElement('#roadmap-editor-panel[hidden]');
        clickElement('button[aria-label="Centrar mapa"]');
      },
      description:
        'El nodo "Proyecto final" tiene configurado un desbloqueo programado: será liberado a los estudiantes en la fecha y hora seleccionados. Puedes configurar esto cuando quieras en el editor de nodos.',
    },
    {
      element: nodeControlOrConfirmation(practiceNodeIds.g),
      title: 'Oculta un nodo',
      description:
        'Abre el menú de acciones y oculta este nodo. Esto eliminará todas sus dependencias.',
      advanceWhen: (action) =>
        action.type === 'changeVisibility' &&
        action.nodeId === practiceNodeIds.g &&
        !action.isVisible,
    },
    {
      element: () => (createdNodeId ? document.querySelector(nodeSelector(createdNodeId)) : null),
      title: 'Agregar recursos',
      description:
        'Puedes agregar recursos a tus nodos, como archivos o enlaces. Lo puedes hacer a través del menú de acciones, o a través del panel de edición',
    },
    {
      element: confirmationOrCanvas,
      title: 'Elimina tu nodo',
      description:
        'Abre el menú de tu nodo y elige "Eliminar nodo". Antes de eliminar verás qué recursos y dependencias se pierden.',
      advanceWhen: (action) => action.type === 'deleteNode' && action.nodeId === createdNodeId,
    },
    {
      element: 'button[aria-label="Vista estudiante"]',
      title: 'Vista estudiante',
      description: 'Presiona "Vista estudiante" para ver el mapa como lo ve un estudiante.',
      advanceWhen: (action) => action.type === 'enterCanvasPreview',
    },
    {
      element: nodeDetailOr(practiceNodeIds.a),
      title: 'Completa un nodo',
      // The student view keeps the editor's viewport, which may leave Introducción out.
      prepare: () => clickElement('button[aria-label="Centrar mapa"]'),
      description: 'Abre Introducción y presiona "Completar", como lo haría un estudiante.',
      advanceWhen: (action) =>
        action.type === 'completeSimulatedNode' && action.nodeId === practiceNodeIds.a,
    },
    {
      element: canvas,
      title: 'Nodos liberados',
      description:
        'Al completar Introducción se liberan Conceptos básicos y Lectura complementaria, que dependían de ella.',
    },
    {
      element: () =>
        [...document.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === 'Ir al editor',
        ) ?? null,
      title: 'Vuelve al editor',
      description: 'Presiona "Ir al editor" para salir de la vista estudiante.',
      advanceWhen: (action) => action.type === 'exitCanvasPreview',
    },
    {
      element: canvas,
      title: 'Tutorial completado',
      description:
        'Ya conoces lo esencial para editar un roadmap. Nada de lo que hiciste aquí se guardó.',
    },
  ];
}
