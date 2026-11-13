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
import type { PracticeCanvasAction } from '@/features/roadmap/session/types';
import {
  CREATE_NODE_MENU_ITEM_LABEL,
  NODE_TYPES_MENU_ITEM_LABEL,
} from '@/features/roadmap/editor/types';
import { compactCanvasLayoutQuery } from '@/features/roadmap/ui/compact-canvas-layout';
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

function openCreationMenu() {
  const button = document.querySelector<HTMLButtonElement>('button[aria-label="Crear en el mapa"]');
  if (button?.getAttribute('aria-expanded') !== 'true') button?.click();
}

function closeCreationMenu() {
  document
    .querySelector('[role="menu"]')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
}

function nodeTypesControl() {
  return (
    document
      .querySelector('button[aria-label="Cerrar tipos de nodo"]')
      ?.closest('[role="dialog"]') ??
    floatingMenuItem(NODE_TYPES_MENU_ITEM_LABEL) ??
    document.querySelector('button[aria-label="Crear en el mapa"]')
  );
}

function nodeCreator() {
  const dialog = document.getElementById('new-node-title')?.closest('[role="dialog"]');
  const layer = document.querySelector('button[aria-label="Crear en el mapa"]')?.parentElement;
  const createAction = [...(layer?.querySelectorAll('[role="menuitem"]') ?? [])].find(
    (item) => item.textContent?.trim() === CREATE_NODE_MENU_ITEM_LABEL,
  );
  return dialog ?? createAction ?? layer ?? null;
}

function confirmationOrCanvas() {
  return (
    document.querySelector('[role="alertdialog"]:not(.u-roadmaps-tour-exit)') ??
    document.querySelector('[id^="node-actions-"]') ??
    document.querySelector(canvas)
  );
}

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

function nodeControlOrConfirmation(nodeId: string) {
  return () =>
    document.querySelector('[role="alertdialog"]:not(.u-roadmaps-tour-exit)') ??
    document.getElementById(`node-actions-${nodeId}`) ??
    document.querySelector(nodeSelector(nodeId));
}

function nodeDetailOr(nodeId: string) {
  return () =>
    document.querySelector('[aria-labelledby="student-node-detail-title"]') ??
    document.querySelector(nodeSelector(nodeId));
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
  return [
    ...mapNavigationSteps,
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
      prepare: () => revealNodes(...Object.values(practiceNodeIds)),
      description: () => {
        const target = nodeCreator();
        if (target?.getAttribute('role') === 'dialog')
          return 'Escribe un título, elige el tipo de nodo y déjalo visible para estudiantes.';
        if (target?.getAttribute('role') === 'menuitem')
          return (
            <>
              Elige <TutorialAction icon={CirclePlus}>Crear nodo</TutorialAction>.
            </>
          );
        return 'A continuación, presiona el botón flotante.';
      },
      side: 'top',
      popoverOffset: 40,
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
      description: () => (
        <>
          En el menú del botón flotante, la opción{' '}
          <TutorialAction icon={Shapes}>Tipos de nodo</TutorialAction> te permite crear tus propios
          tipos personalizados.
        </>
      ),
      side: 'top',
    },
    {
      element: canvas,
      title: 'Conecta tu nodo',
      prepare: () => {
        clickElement('button[aria-label="Cerrar tipos de nodo"]');
        closeCreationMenu();
        return revealNodes(createdNodeId, practiceNodeIds.e);
      },
      description: () => (
        <>
          Coloca el cursor sobre tu nodo, y arrastra una de las flechas que aparecen, o haz click en
          una flecha y luego en el nodo <TutorialNode title="Control 1" type="Evaluación" />.
        </>
      ),
      advanceWhen: (action) =>
        action.type === 'connectNodes' &&
        action.sourceNodeId === createdNodeId &&
        action.targetNodeId === practiceNodeIds.e,
    },
    {
      element: () => (createdNodeId ? document.querySelector(nodeSelector(createdNodeId)) : null),
      title: 'Selecciona tu nodo',
      prepare: () => revealNodes(createdNodeId),
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
      description: () => (
        <>
          Aquí puedes cambiar múltiples propiedades del nodo, como su título, tipo, contenido,
          recursos, <TutorialAction icon={LockKeyhole}>bloquear</TutorialAction>,{' '}
          <TutorialAction icon={EyeOff}>ocultar</TutorialAction>, etc.
        </>
      ),
      side: 'left',
    },
    {
      element: branchBlockControl,
      title: 'Bloquea un nodo',
      prepare: async () => {
        clickElement('#roadmap-editor-panel button[aria-label="Deseleccionar nodo"]');
        await waitForElement('#roadmap-editor-panel[hidden]');
        await revealNodes(practiceNodeIds.b);
      },
      side: 'top',
      description: () => {
        const target = branchBlockControl();
        if (target?.getAttribute('role') === 'alertdialog')
          return (
            <>
              Selecciona <TutorialAction icon={LockKeyhole}>Bloquear nodo</TutorialAction>. Debido a
              que este nodo posee otros dependientes a él, estos también serán bloqueados.
            </>
          );
        if (target?.getAttribute('aria-label') === 'Bloquear nodo')
          return (
            <>
              Elige <TutorialAction icon={LockKeyhole}>Bloquear nodo</TutorialAction>.
            </>
          );
        return (
          <>
            Abre el <TutorialAction icon={Settings}>Menú de acciones</TutorialAction>.
          </>
        );
      },
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
          <TutorialNode title="Conceptos básicos" />: <TutorialNode title="Ejercicios guiados" />,{' '}
          <TutorialNode title="Control 1" type="Evaluación" />,{' '}
          <TutorialNode title="Proyecto final" type="Evaluación" /> y{' '}
          <TutorialNode title="Retroalimentación del control" />.
        </>
      ),
    },
    {
      element: nodeControlOrConfirmation(practiceNodeIds.b),
      title: 'Desbloquea el nodo',
      side: 'top',
      description: () => (
        <>
          Abre otra vez el <TutorialAction icon={LockKeyhole}>Menú de acciones</TutorialAction> del
          nodo <TutorialNode title="Conceptos básicos" /> y elige{' '}
          <TutorialAction icon={LockKeyholeOpen}>Desbloquear</TutorialAction>. Puedes elegir entre
          desbloquear solo este nodo, o incluir además a los dependientes de él.
        </>
      ),
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
      description: () => (
        <>
          El nodo <TutorialNode title="Proyecto final" type="Evaluación" /> tiene configurado un
          desbloqueo programado: será liberado a los estudiantes en la fecha y hora seleccionados.
          Puedes configurar esto cuando quieras en el editor de nodos.
        </>
      ),
    },
    {
      element: nodeControlOrConfirmation(practiceNodeIds.g),
      title: 'Oculta un nodo',
      side: 'top',
      description: () => (
        <>
          Abre el <TutorialAction icon={Settings}>Menú de acciones</TutorialAction> y elige{' '}
          <TutorialAction icon={EyeOff}>Ocultar para estudiantes</TutorialAction> para ocultar este
          nodo. Esto eliminará todas sus dependencias.
        </>
      ),
      advanceWhen: (action) =>
        action.type === 'changeVisibility' &&
        action.nodeId === practiceNodeIds.g &&
        !action.isVisible,
    },
    {
      element: () => (createdNodeId ? document.querySelector(nodeSelector(createdNodeId)) : null),
      title: 'Agregar recursos',
      description: () => (
        <>
          Puedes <TutorialAction icon={FilePlusCorner}>agregar recursos</TutorialAction> a tus
          nodos, como archivos o enlaces. Lo puedes hacer a través del{' '}
          <TutorialAction icon={Settings}>Menú de acciones</TutorialAction>, o a través del panel de
          edición.
        </>
      ),
    },
    {
      element: confirmationOrCanvas,
      title: 'Elimina tu nodo',
      side: 'top',
      prepare: () => revealNodes(createdNodeId),
      description: () => (
        <>
          Abre el <TutorialAction icon={Settings}>Menú de acciones</TutorialAction> de tu nodo y
          elige{' '}
          <TutorialAction icon={Trash2} intent="destructive">
            Eliminar nodo
          </TutorialAction>
          . Antes de eliminar verás qué recursos y dependencias se pierden.
        </>
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
      element: nodeDetailOr(practiceNodeIds.a),
      title: 'Completa un nodo',
      prepare: () => clickElement('button[aria-label="Centrar mapa"]'),
      description: () => (
        <>
          Abre <TutorialNode title="Introducción" /> y presiona{' '}
          <TutorialAction icon={CircleCheckBig}>Completar</TutorialAction>, como lo haría un
          estudiante.
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
