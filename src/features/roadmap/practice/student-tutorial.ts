import { clickElement, type TutorialStep } from '@/shared/client/tutorial/tutorial-support';
import { compactCanvasLayoutQuery } from '@/features/roadmap/ui/compact-canvas-layout';
import { pulseControlDependencies } from './tutorial-dependency-pulse';
import { practiceNodeIds } from './practice-roadmap';

export const canvas = '.react-flow';
export const nodeSelector = (id: string) => `.react-flow__node[data-id="${id}"]`;

export const mapNavigationSteps = [
  {
    element: canvas,
    title: 'Muévete por el mapa',
    description:
      'Arrastra el fondo para desplazarte. Para acercar o alejar el mapa, pellizca la pantalla o usa la rueda del mouse.',
    allowInteraction: true,
  },
  {
    element: 'button[aria-label="Centrar mapa"]',
    title: 'Centrar mapa',
    description: 'Si te pierdes, este botón vuelve a mostrar el mapa completo.',
    allowInteraction: true,
  },
] as const;

export const nodeTypeAndResourcesStep = {
  focusZoom: 1.4,
  element: nodeSelector(practiceNodeIds.c),
  title: 'Nodos',
  description:
    'El nodo es la unidad fundamental del roadmap. El icono y color indican el tipo de nodo. Su título indica el propósito o temática. Los contadores representan cuántos archivos y enlaces contiene dentro.',
};

export function studentTutorialSteps(isAuthenticated: boolean): readonly TutorialStep[] {
  return [
    ...mapNavigationSteps,
    nodeTypeAndResourcesStep,
    {
      element: nodeSelector(practiceNodeIds.a),
      title: 'Nodo completado',
      focusZoom: 1.4,
      description: 'Este nodo ya está completado.',
    },
    {
      element: nodeSelector(practiceNodeIds.b),
      title: 'Nodo pendiente',
      focusZoom: 1.4,
      description:
        'Este nodo está pendiente. Para completarlo, debes descargar y acceder a todos sus recursos, si es que los tiene.',
    },
    {
      element: nodeSelector(practiceNodeIds.e),
      title: 'Bloqueado por dependencias',
      focusZoom: 1.2,
      side: 'right',
      highlightElements: () =>
        [practiceNodeIds.b, practiceNodeIds.c, practiceNodeIds.d, practiceNodeIds.e].flatMap(
          (id) => {
            const node = document.querySelector(nodeSelector(id));
            return node ? [node] : [];
          },
        ),
      onEnter: pulseControlDependencies,
      description:
        'Este nodo se liberará cuando completes todos los nodos anteriores de los que depende.',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Bloqueado por el equipo docente',
      focusZoom: 1.4,
      description:
        'Este nodo está bloqueado por el equipo docente, solo se liberará cuando lo decidan.',
    },
    {
      element: `${nodeSelector(practiceNodeIds.c)} [role="img"][aria-label$="sin revisar"]`,
      title: 'Cambios sin revisar',
      focusZoom: 1.4,
      prepare: () => clickElement('button[aria-label="Cerrar detalle"]'),
      description:
        'Esta marca indica que el nodo cambió desde la última vez que lo abriste. Al abrirlo, la marca desaparece.',
    },
    {
      element: '#student-node-detail-panel',
      title: 'Detalle del nodo',
      description:
        'Aquí puedes encontrar el contenido del nodo junto a todo el material docente y enlaces del nodo.',
      side: 'left',
      prepare: () => clickElement(nodeSelector(practiceNodeIds.c)),
    },
    {
      element: isAuthenticated ? 'button[aria-label^="Avisos"]' : '[data-global-navigation]',
      title: 'Avisos y resumen de cambios',
      description: isAuthenticated
        ? 'Cuando el equipo docente cambia tu roadmap, recibes avisos aquí. Al entrar a tu roadmap, un resumen de cambios te muestra lo nuevo.'
        : 'Cuando ingreses con U-Pasaporte, tendrás un buzón de avisos sobre los cambios de tus roadmaps. Al entrar a cada roadmap, un resumen de cambios te mostrará lo nuevo.',
      side: 'bottom',
      prepare: () => {
        if (window.matchMedia(compactCanvasLayoutQuery).matches)
          clickElement('button[aria-label="Cerrar detalle"]');
      },
    },
  ];
}
