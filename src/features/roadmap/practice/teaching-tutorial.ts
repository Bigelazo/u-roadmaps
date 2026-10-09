import { clickElement, type TutorialStep } from '@/shared/client/tutorial/tutorial';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { practiceNodeIds } from './practice-roadmap';

const canvas = '.react-flow';
const nodeSelector = (id: string) => `.react-flow__node[data-id="${id}"]`;

/** "Crear en el mapa", its menu while open, or the creation dialog while open. */
function nodeCreator() {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) =>
    candidate.textContent?.includes('Agregar al mapa'),
  );
  const layer = document.querySelector('button[aria-label="Crear en el mapa"]')?.parentElement;
  return dialog ?? layer?.querySelector('[role="menu"]') ?? layer ?? null;
}

/** The open Resource form, or the canvas, where the Node action menu opens. */
function resourceComposerOrCanvas() {
  return (
    document.querySelector('[aria-label="Editor de recurso"]') ?? document.querySelector(canvas)
  );
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
export function teachingTutorialSteps(
  resourceSuggestion: { set: (isSuggesting: boolean) => void } = { set: () => undefined },
): readonly TutorialStep<PracticeCanvasAction>[] {
  let createdNodeId: string | null = null;
  return [
    {
      element: 'button[aria-label="Centrar mapa"]',
      title: 'Centrar mapa',
      description:
        'Arrastra el fondo para desplazarte y usa la rueda del mouse para acercar o alejar. Presiona este botón para volver a ver el mapa completo.',
      advanceWhen: (action) => action.type === 'fitView',
    },
    {
      element: nodeSelector(practiceNodeIds.c),
      title: 'Tipo de nodo y recursos',
      description:
        'El ícono y su nombre indican el tipo de nodo, como Material extra. Los contadores muestran cuántos enlaces y archivos contiene.',
    },
    {
      element: nodeSelector(practiceNodeIds.h),
      title: 'Nodo oculto',
      description:
        'Este ícono marca un nodo oculto para estudiantes: solo el equipo docente lo ve.',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Bloqueo docente',
      description:
        'Este ícono marca un nodo bloqueado por el equipo docente. Tus estudiantes no pueden trabajar en él hasta que lo liberes.',
    },
    {
      element: nodeCreator,
      title: 'Crea un nodo',
      description:
        'Presiona "Crear en el mapa" y elige "Crear nodo". Escribe un título, elige su tipo y deja marcado "Visible para estudiantes". En la descripción puedes escribir Markdown o arrastrar un archivo .md para reemplazar el texto. Desde "Gestionar tipos de nodo" puedes crear tus propios tipos.',
      side: 'top',
      advanceWhen: (action) => {
        if (action.type !== 'addNode') return false;
        createdNodeId = action.nodeId;
        return true;
      },
    },
    {
      element: '.react-flow',
      title: 'Conecta tu nodo',
      description:
        'Arrastra desde el borde de tu nuevo nodo hasta Control 1 para crear una dependencia.',
      advanceWhen: (action) =>
        action.type === 'connectNodes' &&
        action.sourceNodeId === createdNodeId &&
        action.targetNodeId === practiceNodeIds.e,
    },
    {
      element: nodeSelector(practiceNodeIds.e),
      title: 'Dependencias',
      description:
        'Tu nodo ahora es prerrequisito de Control 1: un nodo queda bloqueado hasta completar sus prerrequisitos. No se permiten ciclos. Para borrar una dependencia, selecciona su flecha y presiona "Eliminar dependencia".',
    },
    {
      element: '.react-flow',
      title: 'Selecciona tu nodo',
      description: 'Haz clic en el nodo que creaste para editarlo.',
      advanceWhen: (action) => action.type === 'selectNode' && action.nodeId === createdNodeId,
    },
    {
      element: '[aria-label="Editor de nodo"]',
      title: 'Editor de nodo',
      description:
        'Aquí cambias el título, la descripción, que admite Markdown, y el tipo del nodo.',
      side: 'left',
    },
    {
      element: canvas,
      title: 'Bloquea una rama',
      description:
        'Abre el menú de acciones de Conceptos básicos y elige "Bloquear rama". El bloqueo docente impide que tus estudiantes trabajen en un nodo.',
      advanceWhen: (action) =>
        action.type === 'changeTeacherBlock' &&
        action.nodeId === practiceNodeIds.b &&
        action.operation === 'BLOCK',
    },
    {
      element: canvas,
      title: 'Bloqueo propagado',
      description:
        'El bloqueo docente se propaga a los nodos que dependen de Conceptos básicos: Ejercicios guiados, Control 1, Proyecto final y Retroalimentación del control.',
    },
    {
      element: canvas,
      title: 'Desbloquea la rama',
      description:
        'Abre otra vez el menú de Conceptos básicos y elige "Desbloquear". Puedes desbloquear solo este nodo o toda la rama.',
      advanceWhen: (action) =>
        action.type === 'changeTeacherBlock' &&
        action.nodeId === practiceNodeIds.b &&
        action.operation !== 'BLOCK',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Desbloqueo programado',
      description:
        'Proyecto final tiene un desbloqueo programado: se libera solo en la fecha que elegiste. Lo configuras en el editor de un nodo con bloqueo docente.',
    },
    {
      element: canvas,
      title: 'Oculta un nodo',
      description:
        'Abre el menú de Retroalimentación del control y elige "Ocultar para estudiantes". Al ocultarlo se eliminan sus dependencias.',
      advanceWhen: (action) =>
        action.type === 'changeVisibility' &&
        action.nodeId === practiceNodeIds.g &&
        !action.isVisible,
    },
    {
      element: resourceComposerOrCanvas,
      title: 'Agrega un recurso',
      prepare: () => resourceSuggestion.set(true),
      description:
        'Abre el menú de tu nodo y elige "Agregar recurso". Dejamos un enlace listo: solo presiona "Agregar enlace".',
      advanceWhen: (action) => action.type === 'addResource' && action.nodeId === createdNodeId,
    },
    {
      element: canvas,
      title: 'Elimina tu nodo',
      prepare: () => resourceSuggestion.set(false),
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
