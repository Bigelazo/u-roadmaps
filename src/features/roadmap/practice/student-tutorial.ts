import { clickElement, type TutorialStep } from '@/shared/client/tutorial/tutorial';
import { practiceNodeIds } from './practice-roadmap';

const node = (id: string) => `.react-flow__node[data-id="${id}"]`;

/** The student Roadmap tutorial on the Practice roadmap: explanatory, advanced with "Siguiente". */
export const studentTutorialSteps: readonly TutorialStep[] = [
  {
    element: '.react-flow',
    title: 'Muévete por el mapa',
    description:
      'Arrastra el fondo para desplazarte y usa la rueda del mouse o el gesto de pellizcar para acercar o alejar el mapa.',
  },
  {
    element: 'button[aria-label="Centrar mapa"]',
    title: 'Centrar mapa',
    description: 'Si te pierdes, este botón vuelve a mostrar el mapa completo.',
  },
  {
    element: node(practiceNodeIds.c),
    title: 'Tipo de nodo y recursos',
    description:
      'El ícono y su nombre indican el tipo de nodo, como Material extra. Los contadores muestran cuántos enlaces y archivos contiene.',
  },
  {
    element: node(practiceNodeIds.a),
    title: 'Nodo completado',
    description: 'Introducción ya está completado: este ícono marca tu trabajo terminado.',
  },
  {
    element: node(practiceNodeIds.b),
    title: 'Nodo pendiente',
    description: 'Conceptos básicos está pendiente: puedes abrirlo y trabajar en él ahora.',
  },
  {
    element: node(practiceNodeIds.d),
    title: 'Bloqueado por prerrequisitos',
    description:
      'Ejercicios guiados se libera cuando completes los nodos anteriores de los que depende.',
  },
  {
    element: node(practiceNodeIds.f),
    title: 'Bloqueado por el equipo docente',
    description:
      'Proyecto final está bloqueado por el equipo docente, que lo liberará cuando lo decida.',
  },
  {
    element: node(practiceNodeIds.e),
    title: 'Dependencias',
    description:
      'Las flechas muestran prerrequisitos. Control 1 tiene tres: debes completarlos todos para liberarlo.',
  },
  {
    element: `${node(practiceNodeIds.c)} [role="img"][aria-label$="sin revisar"]`,
    title: 'Cambios sin revisar',
    description:
      'Esta marca indica que el nodo cambió desde la última vez que lo abriste. Al abrirlo, la marca desaparece.',
  },
  {
    element: '#student-node-detail-panel',
    title: 'Detalle del nodo',
    description:
      'Aquí encuentras la descripción, los recursos y el botón para completar el nodo. Completar un nodo no se puede deshacer, así que úsalo cuando realmente hayas terminado.',
    side: 'left',
    prepare: () => clickElement(node(practiceNodeIds.b)),
  },
  {
    element: 'button[aria-label^="Avisos"]',
    title: 'Avisos y resumen de cambios',
    description:
      'Cuando el equipo docente cambia tu roadmap, recibes avisos aquí. Al entrar a tu roadmap, un resumen de cambios te muestra lo nuevo.',
    side: 'bottom',
  },
];
