import {
  CirclePlus,
  Eye,
  EyeOff,
  FilePlusCorner,
  LockKeyhole,
  LockKeyholeOpen,
  Settings,
  Shapes,
  Trash2,
  CircleCheckBig,
} from 'lucide-react';
import { TutorialAction, TutorialNode } from './tutorial-label';
import {
  clickElement,
  revealTutorialTarget,
  waitForElement,
  type TutorialStep,
} from '@/shared/client/tutorial/tutorial-support';
import type { ReactNode } from 'react';
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import type { TeacherBlockOperation } from '@/features/roadmap/types';
import {
  CREATE_NODE_MENU_ITEM_LABEL,
  NODE_TYPES_MENU_ITEM_LABEL,
} from '@/features/roadmap/editor/types';
import {
  coarsePointerQuery,
  compactCanvasLayoutQuery,
} from '@/features/roadmap/ui/compact-canvas-layout';
import { practiceNodeIds } from './practice-roadmap';
import {
  canvas,
  mapNavigationSteps,
  nodeSelector,
  nodeTypeAndResourcesStep,
} from './student-tutorial';

function floatingMenuItem(label: string) {
  return (
    [...document.querySelectorAll('[role="menuitem"]')].find(
      (item) => item.getAttribute('aria-label') === label || item.textContent?.trim() === label,
    ) ?? null
  );
}

const creationButton = 'button[aria-label="Crear en el mapa"]';
const nodeMenuButton = 'button[aria-label="Abrir menú de acciones del nodo"]';
const connectorPort =
  '[data-slot="roadmap-card"] > .react-flow__handle.roadmap-node-port[data-node-connector]';
const visibilityField = '[role="radiogroup"][aria-labelledby="new-node-access-label"]';
const highlighted = '.driver-active-element';
const tutorialInterface = '.driver-popover, [data-tutorial-exit], .u-roadmaps-tour-exit';
const guardedSurface =
  '.react-flow, #roadmap-editor-panel, [role="dialog"], [role="alertdialog"], [role="menu"], [data-base-ui-portal]';
const guardedEvents = [
  'pointerdown',
  'mousedown',
  'touchstart',
  'click',
  'dblclick',
  'contextmenu',
  'keydown',
] as const;
const activationKeys = new Set(['Enter', 'Delete', 'Backspace']);
const dimmed = 'filter: brightness(0.45);';
const inert = 'pointer-events: none !important;';

const creationControlsOutsideHighlight = `
  ${creationButton}:not(${highlighted}, ${highlighted} *),
  ${creationButton}:not(${highlighted}, ${highlighted} *) * { ${inert} }
  ${creationButton}:not(${highlighted}, ${highlighted} *) { ${dimmed} }
  [role="menu"] [role="menuitem"]:not(${highlighted}, ${highlighted} *),
  [role="menu"] [role="menuitem"]:not(${highlighted}, ${highlighted} *) * { ${inert} ${dimmed} }
`;

function isInsideHighlight(target: Element) {
  return Boolean(target.closest(highlighted));
}

function restrictInteraction(
  allows: (target: Element, event: Event) => boolean,
  restrictedStyles = '',
) {
  const style = document.createElement('style');
  style.textContent = creationControlsOutsideHighlight + restrictedStyles;
  document.head.append(style);
  const guard = (event: Event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target?.closest(guardedSurface) || target.closest(tutorialInterface)) return;
    if (event instanceof KeyboardEvent && !activationKeys.has(event.key) && event.key.length !== 1)
      return;
    if (allows(target, event)) return;
    if (event.type !== 'touchstart') event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of guardedEvents)
    window.addEventListener(type, guard, { capture: true, passive: false });
  return () => {
    for (const type of guardedEvents) window.removeEventListener(type, guard, { capture: true });
    style.remove();
  };
}

function nodeOf(nodeId: string) {
  return `.react-flow__node[data-id="${nodeId}"]`;
}

function inertSelectors(selectors: readonly string[]) {
  return `${selectors.flatMap((selector) => [selector, `${selector} *`]).join(',\n')} { ${inert} }`;
}

function panAndZoomOnly() {
  return restrictInteraction(
    (target, event) =>
      event.type !== 'contextmenu' &&
      !(event instanceof KeyboardEvent) &&
      Boolean(target.closest('.react-flow__pane')),
    inertSelectors([
      '.react-flow .react-flow__node',
      '.react-flow .react-flow__edge',
      '.react-flow .react-flow__panel',
    ]),
  );
}

function highlightOnly() {
  return restrictInteraction(isInsideHighlight);
}

function openCreationMenu() {
  const button = document.querySelector<HTMLButtonElement>(creationButton);
  if (button?.getAttribute('aria-expanded') !== 'true') button?.click();
}

function closeCreationMenu() {
  document
    .querySelector('[role="menu"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function nodeTypesDialog() {
  return (
    document
      .querySelector('button[aria-label="Cerrar tipos de nodo"]')
      ?.closest('[role="dialog"]') ?? null
  );
}

function nodeTypesControl() {
  return (
    nodeTypesDialog() ??
    floatingMenuItem(NODE_TYPES_MENU_ITEM_LABEL) ??
    document.querySelector(creationButton)
  );
}

function nodeCreationDialog() {
  return document.getElementById('new-node-title')?.closest('[role="dialog"]') ?? null;
}

function closeNodeCreationDialog() {
  const cancel = [...(nodeCreationDialog()?.querySelectorAll('button') ?? [])].find(
    (button) => button.textContent?.trim() === 'Cancelar',
  );
  cancel?.click();
}

function createNodeOnly() {
  const release = restrictInteraction(
    (target) =>
      !target.closest(visibilityField) &&
      Boolean(
        nodeCreator()?.contains(target) || target.closest('[role="alertdialog"], [role="listbox"]'),
      ),
    inertSelectors([visibilityField, `${creationButton}[aria-expanded="true"]`]),
  );
  return () => {
    release();
    closeNodeCreationDialog();
    closeCreationMenu();
  };
}

function exploreNodeTypes() {
  const release = restrictInteraction((target) =>
    Boolean(
      nodeTypesControl()?.contains(target) ||
      target.closest('[role="dialog"], [role="alertdialog"], [role="listbox"]'),
    ),
  );
  let wasOpen = Boolean(nodeTypesDialog());
  const watcher = setInterval(() => {
    const isOpen = Boolean(nodeTypesDialog());
    if (wasOpen && !isOpen)
      document.querySelector<HTMLElement>('.driver-popover .driver-popover-next-btn')?.click();
    wasOpen = isOpen;
  }, 100);
  return () => {
    clearInterval(watcher);
    release();
    clickElement('button[aria-label="Cerrar tipos de nodo"]');
    closeCreationMenu();
  };
}

function connectionArea(sourceId: string | null, targetId: string) {
  const nodes = [sourceId, targetId].map((nodeId) =>
    nodeId ? document.querySelector(nodeSelector(nodeId)) : null,
  );
  if (!nodes[0] || !nodes[1]) return null;
  const bounds = nodes.map((node) => node!.getBoundingClientRect());
  const margin = 24;
  const left = Math.min(...bounds.map((rect) => rect.left)) - margin;
  const top = Math.min(...bounds.map((rect) => rect.top)) - margin;
  const area =
    document.querySelector<HTMLElement>('[data-tutorial-connection-area]') ??
    document.body.appendChild(Object.assign(document.createElement('div'), { ariaHidden: 'true' }));
  area.setAttribute('data-tutorial-connection-area', '');
  Object.assign(area.style, {
    position: 'fixed',
    pointerEvents: 'none',
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(...bounds.map((rect) => rect.right)) + margin - left}px`,
    height: `${Math.max(...bounds.map((rect) => rect.bottom)) + margin - top}px`,
  });
  return area;
}

function connectFromSourceOnly(sourceId: string | null, targetId: string) {
  const source = nodeOf(sourceId ?? '');
  const target = nodeOf(targetId);
  const release = restrictInteraction(
    (element, event) => {
      if (element.closest(source))
        return event.type === 'touchstart' || Boolean(element.closest('[data-node-connector]'));
      return (
        Boolean(element.closest(target)) &&
        Boolean(document.querySelector('.roadmap-node--arrow-source'))
      );
    },
    `
      .react-flow .react-flow__node:not([data-id="${sourceId}"], [data-id="${targetId}"]),
      .react-flow .react-flow__node:not([data-id="${sourceId}"], [data-id="${targetId}"]) * { ${inert} }
      ${source}, ${source} *, ${target}, ${target} * { pointer-events: auto !important; }
      ${inertSelectors([
        `${target} ${connectorPort}`,
        `${source} ${nodeMenuButton}`,
        `${target} ${nodeMenuButton}`,
      ])}
    `,
  );
  return () => {
    release();
    document.querySelector('[data-tutorial-connection-area]')?.remove();
  };
}

function selectNodeOnly(nodeId: string | null) {
  const node = nodeOf(nodeId ?? '');
  return restrictInteraction(
    (target, event) =>
      Boolean(target.closest(node)) &&
      !target.closest(`[data-node-connector], ${nodeMenuButton}`) &&
      (event.type === 'click' || event instanceof KeyboardEvent),
    inertSelectors([`${node} ${connectorPort}`, `${node} ${nodeMenuButton}`]),
  );
}

function readOnlyEditor() {
  return restrictInteraction(
    () => false,
    inertSelectors(['#roadmap-editor-panel [data-slot="sidebar-content"] *']),
  );
}

function nodeCreator() {
  const dialog = nodeCreationDialog();
  const layer = document.querySelector(creationButton)?.parentElement;
  const createAction = [...(layer?.querySelectorAll('[role="menuitem"]') ?? [])].find(
    (item) => item.textContent?.trim() === CREATE_NODE_MENU_ITEM_LABEL,
  );
  return dialog ?? createAction ?? layer ?? null;
}

function confirmationDialog(confirmationLabel?: string) {
  return (
    [...document.querySelectorAll('[role="alertdialog"]:not(.u-roadmaps-tour-exit)')].find(
      (dialog) =>
        !confirmationLabel ||
        [...dialog.querySelectorAll('button')].some(
          (button) => button.textContent?.trim() === confirmationLabel,
        ),
    ) ?? null
  );
}

function nodeActionControl(
  nodeId: () => string | null,
  actionLabel: string,
  confirmationLabel?: string,
) {
  return () => {
    const id = nodeId();
    if (!id) return null;
    const node = document.querySelector(nodeSelector(id));
    const menu = document.getElementById(`node-actions-${id}`);
    const action = menu
      ? [...menu.querySelectorAll('button')].find(
          (button) =>
            button.getAttribute('aria-label') === actionLabel ||
            button.textContent?.trim() === actionLabel,
        )
      : null;
    return (
      confirmationDialog(confirmationLabel) ??
      action ??
      node?.querySelector('button[aria-label="Abrir menú de acciones del nodo"]') ??
      node
    );
  };
}

const openNodeActions = (
  <>
    Abre el menú <TutorialAction icon={Settings}>Acciones del nodo</TutorialAction>.
  </>
);

function nodeActionDescription(
  control: () => Element | null,
  chooseAction: ReactNode,
  confirmation: ReactNode,
) {
  return function describeNodeAction() {
    const target = control();
    if (target?.getAttribute('role') === 'alertdialog') return confirmation;
    if (target?.closest('[id^="node-actions-"]')) return chooseAction;
    return openNodeActions;
  };
}

function completionControl(nodeId: string) {
  return () => {
    const detail = document.querySelector('[aria-labelledby="student-node-detail-title"]');
    const complete = detail
      ? [...detail.querySelectorAll('button')].find(
          (button) => button.textContent?.trim() === 'Completar',
        )
      : null;
    return complete ?? document.querySelector(nodeSelector(nodeId));
  };
}

function buttonWithText(text: string) {
  return () =>
    [...document.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === text,
    ) ?? null;
}

async function closeNodeEditor() {
  clickElement('#roadmap-editor-panel button[aria-label="Deseleccionar nodo"]');
  await waitForElement('#roadmap-editor-panel[hidden]');
}

function revealNodes(...nodeIds: readonly (string | null)[]) {
  return revealTutorialTarget(
    nodeIds.flatMap((nodeId) => {
      const node = nodeId ? document.querySelector(nodeSelector(nodeId)) : null;
      return node ? [node] : [];
    }),
  );
}

export function teachingTutorialSteps(): readonly TutorialStep<PracticeCanvasAction>[] {
  let createdNodeId: string | null = null;
  let unlockOperation: TeacherBlockOperation | null = null;
  const createdNode = () => createdNodeId;
  const blockControl = nodeActionControl(() => practiceNodeIds.b, 'Bloquear nodo', 'Bloquear nodo');
  const unlockControl = nodeActionControl(() => practiceNodeIds.e, 'Desbloquear');
  const hideControl = nodeActionControl(() => practiceNodeIds.g, 'Ocultar para estudiantes');
  const deleteControl = nodeActionControl(createdNode, 'Eliminar nodo');
  const [moveAroundStep, centerMapStep] = mapNavigationSteps;
  return [
    { ...moveAroundStep, onEnter: panAndZoomOnly },
    { ...centerMapStep, onEnter: highlightOnly },
    nodeTypeAndResourcesStep,
    {
      element: nodeSelector(practiceNodeIds.h),
      title: 'Nodo oculto',
      focusZoom: 1.4,
      description:
        'Esta representación marca un nodo que está oculto para estudiantes: solo el equipo docente puede verlo.',
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Nodo bloqueado',
      focusZoom: 1.4,
      description:
        'Esta representación marca un nodo bloqueado por el equipo docente. Los estudiantes pueden verlo en el roadmap, pero no pueden acceder a él hasta que lo liberes.',
    },
    {
      element: nodeCreator,
      title: 'Crea un nodo',
      description: () => {
        const target = nodeCreator();
        if (target?.getAttribute('role') === 'dialog')
          return 'Escribe un título y, si quieres, una descripción o un tipo distinto. Durante el tutorial, el nodo quedará visible para estudiantes.';
        if (target?.getAttribute('role') === 'menuitem')
          return (
            <>
              Elige <TutorialAction icon={CirclePlus}>Crear nodo</TutorialAction>.
            </>
          );
        return 'A continuación, presiona el botón flotante.';
      },
      side: 'left',
      popoverOffset: 32,
      onEnter: () => {
        void revealNodes(...Object.values(practiceNodeIds));
        return createNodeOnly();
      },
      advanceWhen: (action) => {
        if (action.type !== 'addNode') return false;
        createdNodeId = action.nodeId;
        return true;
      },
    },
    {
      element: nodeTypesControl,
      allowInteraction: true,
      title: 'Tipos de nodo',
      prepare: async () => {
        openCreationMenu();
        await waitForElement(() => floatingMenuItem(NODE_TYPES_MENU_ITEM_LABEL));
      },
      onEnter: exploreNodeTypes,
      description: () => (
        <>
          En el menú del botón flotante, la opción{' '}
          <TutorialAction icon={Shapes}>Tipos de nodo</TutorialAction> te permite crear tus propios
          tipos personalizados. Si la abres, el tutorial continuará cuando la cierres.
        </>
      ),
      side: 'top',
    },
    {
      element: () => connectionArea(createdNodeId, practiceNodeIds.e),
      title: 'Conecta tu nodo',
      prepare: () => revealNodes(createdNodeId, practiceNodeIds.e),
      onEnter: () => connectFromSourceOnly(createdNodeId, practiceNodeIds.e),
      description: () => {
        const control = <TutorialNode title="Control 1" type="Evaluación" />;
        return window.matchMedia(coarsePointerQuery).matches ? (
          <>
            Mantén presionado tu nodo hasta que se active el modo flecha y luego toca {control}. La
            dirección importa: {control} pasará a depender de tu nodo.
          </>
        ) : (
          <>
            Pasa sobre tu nodo para ver sus flechas. Arrastra una hasta {control}, o haz clic en una
            flecha y luego en {control}. La dirección importa: {control} pasará a depender de tu
            nodo.
          </>
        );
      },
      advanceWhen: (action) =>
        action.type === 'connectNodes' &&
        action.sourceNodeId === createdNodeId &&
        action.targetNodeId === practiceNodeIds.e,
    },
    {
      element: () => (createdNodeId ? document.querySelector(nodeSelector(createdNodeId)) : null),
      title: 'Selecciona tu nodo',
      prepare: () => revealNodes(createdNodeId),
      onEnter: () => selectNodeOnly(createdNodeId),
      description: 'Selecciona el nodo que creaste para editarlo.',
      advanceWhen: (action) => action.type === 'selectNode' && action.nodeId === createdNodeId,
    },
    {
      element: '#roadmap-editor-panel [data-slot="sidebar-content"]',
      allowInteraction: true,
      title: 'Editor de nodo',
      prepare: async () => {
        if (!createdNodeId || !document.querySelector('#roadmap-editor-panel[hidden]')) return;
        clickElement(nodeSelector(createdNodeId));
        await waitForElement('#roadmap-editor-panel:not([hidden])');
      },
      onEnter: readOnlyEditor,
      description: () => (
        <>
          Aquí puedes cambiar múltiples propiedades del nodo, como su título, tipo, contenido,
          recursos, <TutorialAction icon={LockKeyhole}>bloquear</TutorialAction>,{' '}
          <TutorialAction icon={EyeOff}>ocultar</TutorialAction>, etc. Por ahora, solo recórrelo.
        </>
      ),
      side: 'left',
    },
    {
      element: blockControl,
      title: 'Bloquea un nodo',
      prepare: async () => {
        await closeNodeEditor();
        await revealNodes(practiceNodeIds.b);
      },
      side: 'top',
      description: nodeActionDescription(
        blockControl,
        <>
          Elige <TutorialAction icon={LockKeyhole}>Bloquear nodo</TutorialAction>.
        </>,
        <>
          Selecciona <TutorialAction icon={LockKeyhole}>Bloquear nodo</TutorialAction>. Debido a que
          este nodo posee otros dependientes a él, estos también serán bloqueados.
        </>,
      ),
      advanceWhen: (action) =>
        action.type === 'changeTeacherBlock' &&
        action.nodeId === practiceNodeIds.b &&
        action.operation === 'BLOCK',
    },
    {
      element: canvas,
      title: 'Bloqueo propagado',
      description: () => (
        <>
          En este caso, el bloqueo se propagó a los nodos dependientes de{' '}
          <TutorialNode title="Conceptos básicos" />:
          <span className="my-1.5 flex flex-col gap-1">
            <TutorialNode title="Ejercicios guiados" />
            <TutorialNode title="Control 1" type="Evaluación" />
            <TutorialNode title="Retroalimentación del control" />
          </span>
          <TutorialNode title="Proyecto final" type="Evaluación" /> ya estaba bloqueado desde antes.
        </>
      ),
    },
    {
      element: unlockControl,
      title: 'Desbloquea un nodo',
      side: 'top',
      prepare: () => revealNodes(practiceNodeIds.e),
      description: nodeActionDescription(
        unlockControl,
        <>
          Elige <TutorialAction icon={LockKeyholeOpen}>Desbloquear</TutorialAction>.
        </>,
        'Desbloquear un nodo que posee prerrequisitos que siguen bloqueados también los desbloqueará. Puedes elegir además entre desbloquear solo este nodo, o incluir además a los dependientes de él.',
      ),
      advanceWhen: (action) => {
        if (
          action.type !== 'changeTeacherBlock' ||
          action.nodeId !== practiceNodeIds.e ||
          action.operation === 'BLOCK'
        )
          return false;
        unlockOperation = action.operation;
        return true;
      },
    },
    {
      element: nodeSelector(practiceNodeIds.f),
      title: 'Desbloqueo programado',
      prepare: async () => {
        await closeNodeEditor();
        clickElement('button[aria-label="Centrar mapa"]');
      },
      description: () =>
        unlockOperation === 'BRANCH_UNLOCK' ? (
          <>
            El nodo <TutorialNode title="Proyecto final" type="Evaluación" /> no fue desbloqueado a
            pesar de ser un dependiente de <TutorialNode title="Control 1" type="Evaluación" /> pues
            está configurado con un desbloqueo programado. Será liberado al estudiantado en la fecha
            y hora seleccionados.
          </>
        ) : (
          <>
            El nodo <TutorialNode title="Proyecto final" type="Evaluación" /> está configurado con
            un desbloqueo programado, será liberado al estudiantado en el día y hora seleccionados.
          </>
        ),
    },
    {
      element: hideControl,
      title: 'Oculta un nodo',
      side: 'top',
      prepare: async () => {
        await closeNodeEditor();
        await revealNodes(practiceNodeIds.g);
      },
      description: nodeActionDescription(
        hideControl,
        <>
          Elige <TutorialAction icon={EyeOff}>Ocultar para estudiantes</TutorialAction>.
        </>,
        <>
          Selecciona <TutorialAction icon={EyeOff}>Ocultar</TutorialAction>. Los estudiantes dejarán
          de verlo y se eliminará su conexión con{' '}
          <TutorialNode title="Control 1" type="Evaluación" />.
        </>,
      ),
      advanceWhen: (action) =>
        action.type === 'changeVisibility' &&
        action.nodeId === practiceNodeIds.g &&
        !action.isVisible,
    },
    {
      element: () => (createdNodeId ? document.querySelector(nodeSelector(createdNodeId)) : null),
      title: 'Agregar recursos',
      prepare: () => revealNodes(createdNodeId),
      description: () => (
        <>
          Tus nodos pueden tener recursos, como archivos o enlaces. Se agregan con{' '}
          <TutorialAction icon={FilePlusCorner}>Agregar recurso</TutorialAction> en el menú{' '}
          <TutorialAction icon={Settings}>Acciones del nodo</TutorialAction>, o desde el panel de
          edición.
        </>
      ),
    },
    {
      element: deleteControl,
      title: 'Elimina tu nodo',
      side: 'top',
      prepare: () => revealNodes(createdNodeId),
      description: nodeActionDescription(
        deleteControl,
        <>
          Elige{' '}
          <TutorialAction icon={Trash2} intent="destructive">
            Eliminar nodo
          </TutorialAction>
          .
        </>,
        'Antes de eliminar podrás ver la cantidad de recursos y dependencias asociadas que se perderán.',
      ),
      advanceWhen: (action) => action.type === 'deleteNode' && action.nodeId === createdNodeId,
    },
    {
      element: 'button[aria-label="Vista estudiante"]',
      title: 'Vista estudiante',
      description: () => (
        <>
          Presiona <TutorialAction icon={Eye}>Vista estudiante</TutorialAction> para ver el mapa
          como lo ve un estudiante.
        </>
      ),
      advanceWhen: (action) => action.type === 'enterCanvasPreview',
    },
    {
      element: canvas,
      title: 'Avance del curso',
      prepare: () => clickElement('button[aria-label="Centrar mapa"]'),
      description:
        'El estudiantado debe completar progresivamente los nodos para poder avanzar con el curso.',
    },
    {
      element: completionControl(practiceNodeIds.a),
      title: 'Completa un nodo',
      prepare: () => revealNodes(practiceNodeIds.a),
      description: () => (
        <>
          Abre <TutorialNode title="Introducción" /> y presiona{' '}
          <TutorialAction icon={CircleCheckBig} intent="success">
            Completar
          </TutorialAction>
          , como lo haría un estudiante.
        </>
      ),
      advanceWhen: (action) =>
        action.type === 'completeCanvasPreviewNode' && action.nodeId === practiceNodeIds.a,
    },
    {
      element: canvas,
      title: 'Nodos liberados',
      prepare: () => {
        if (window.matchMedia(compactCanvasLayoutQuery).matches)
          clickElement('button[aria-label="Cerrar detalle"]');
      },
      description: () => (
        <>
          Al completar <TutorialNode title="Introducción" /> se liberan{' '}
          <TutorialNode title="Conceptos básicos" /> y{' '}
          <TutorialNode title="Lectura complementaria" type="Material extra" />, que dependían de
          ella.
        </>
      ),
    },
    {
      element: buttonWithText('Ir al editor'),
      title: 'Vuelve al editor',
      description: 'Presiona "Ir al editor" para salir de la vista estudiante.',
      advanceWhen: (action) => action.type === 'exitCanvasPreview',
    },
    {
      element: canvas,
      title: 'Tutorial completado',
      description:
        'Ya conoces lo esencial para utilizar el roadmap. Ahora puedes jugar y explorar este mapa de forma libre o salir del tutorial.',
    },
  ];
}
