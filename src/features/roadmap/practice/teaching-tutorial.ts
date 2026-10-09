import type { TutorialStep } from '@/shared/client/tutorial/tutorial';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import { practiceNodeIds } from './practice-roadmap';

const nodeSelector = (id: string) => `.react-flow__node[data-id="${id}"]`;

/** "Crear en el mapa", its menu while open, or the creation dialog while open. */
function nodeCreator() {
  const dialog = [...document.querySelectorAll('[role="dialog"]')].find((candidate) =>
    candidate.textContent?.includes('Agregar al mapa'),
  );
  const layer = document.querySelector('button[aria-label="Crear en el mapa"]')?.parentElement;
  return dialog ?? layer?.querySelector('[role="menu"]') ?? layer ?? null;
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
        'Presiona "Crear en el mapa" y elige "Crear nodo". Escribe un título, elige su tipo y deja marcado "Visible para estudiantes". Desde "Gestionar tipos de nodo" puedes crear tus propios tipos.',
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
  ];
}
