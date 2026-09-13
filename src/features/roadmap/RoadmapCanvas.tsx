'use client';

import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import {
  CircleAlert,
  Eye,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
} from 'lucide-react';
import type { Viewport } from '@xyflow/react';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';
import { canvasStateReducer, initialCanvasState } from '@/features/roadmap/canvas/state';
import { useDependencyWorkflow } from '@/features/roadmap/canvas/dependency-workflow';
import { useTeacherBlockWorkflow } from '@/features/roadmap/canvas/teacher-block-workflow';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { RoadmapGraph, type RoadmapGraphHandle } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import {
  nodeDeletionConfirmation,
  roadmapNodeVisibilityConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { useRoadmap, type StructuralDependency } from '@/features/roadmap/useRoadmap';
import type {
  CourseOfferingIdentifier,
  NodeDeletionImpact,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import type { RoadmapEditorDraftHandle } from '@/features/roadmap/editor/types';
import {
  findOpenRoadmapPosition,
  roadmapNodeSizeForTitle,
  snapToRoadmapGrid,
} from '@/features/roadmap/graph/geometry';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog, type ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';

const RoadmapEditor = dynamic(
  () =>
    import('@/features/roadmap/editor/RoadmapEditor').then(({ RoadmapEditor }) => RoadmapEditor),
  { ssr: false },
);

type Props = {
  identifier: CourseOfferingIdentifier;
  canEdit?: boolean;
  canPreview?: boolean;
  isHistorical?: boolean;
  title: string;
  courseCode: string;
  year: number;
  semester: number;
};

type PendingVisibilityChange = {
  nodeId: string;
  isVisible: boolean;
  dependencies: StructuralDependency[];
};

type PendingNodeDeletion = { nodeId: string } & NodeDeletionImpact;

type PendingSimpleConfirmation =
  | { kind: 'discardNodeDraft'; nodeId: string }
  | { kind: 'discardResourceDraft'; nodeId: string }
  | { kind: 'discardCanvasPreviewDraft' }
  | { kind: 'resetSimulation' };

const simpleConfirmationActionIds = {
  discardDraft: 'discard-draft',
  resetSimulation: 'reset-simulation',
} as const;

function simpleConfirmationPresentation(
  confirmation: PendingSimpleConfirmation,
): ConfirmationPresentation {
  switch (confirmation.kind) {
    case 'discardNodeDraft':
      return {
        title: 'Descartar cambios sin guardar',
        description:
          'Eliminar este Nodo descartará su borrador actual. Puedes seguir editando o descartarlo para continuar.',
        intent: 'warning',
        cancelLabel: 'Seguir editando',
        actions: [{ id: simpleConfirmationActionIds.discardDraft, label: 'Descartar y continuar' }],
      };
    case 'discardResourceDraft':
      return {
        title: 'Descartar cambios sin guardar',
        description:
          'Agregar un recurso a otro nodo reemplazará el borrador actual. Puedes seguir editando o descartarlo para continuar.',
        intent: 'warning',
        cancelLabel: 'Seguir editando',
        actions: [{ id: simpleConfirmationActionIds.discardDraft, label: 'Descartar y continuar' }],
      };
    case 'discardCanvasPreviewDraft':
      return {
        title: 'Descartar cambios sin guardar',
        description:
          'La previsualización muestra únicamente el último estado guardado. Puedes seguir editando o descartar este borrador para continuar.',
        intent: 'warning',
        cancelLabel: 'Seguir editando',
        actions: [
          { id: simpleConfirmationActionIds.discardDraft, label: 'Descartar y previsualizar' },
        ],
      };
    case 'resetSimulation':
      return {
        title: 'Reiniciar progreso de previsualización',
        description:
          'Eliminarás las completaciones simuladas de este Canvas preview. No se eliminarán las Completions estudiantiles. Esta acción no se puede deshacer.',
        intent: 'destructive',
        actions: [{ id: simpleConfirmationActionIds.resetSimulation, label: 'Reiniciar progreso' }],
      };
  }
}

function KeyboardShortcut({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <>
      <dt className="flex min-h-5 min-w-0 items-center">{keys}</dt>
      <dd className="leading-relaxed">{children}</dd>
    </>
  );
}

function KeyboardShortcuts({
  isEditing,
  isSidePanelOpen,
}: {
  isEditing: boolean;
  isSidePanelOpen: boolean;
}) {
  return (
    <details
      aria-label="Atajos de teclado"
      data-placement="roadmap"
      className={cn(
        'group pointer-events-auto absolute right-5 bottom-[18px] z-4 w-[min(23rem,calc(100%-2.5rem))] overflow-hidden rounded-xl border border-border bg-card/95 text-xs text-muted-foreground shadow-lg shadow-black/5 backdrop-blur-sm',
        isSidePanelOpen &&
          'lg:right-[calc(var(--sidebar-width)+1.25rem)] lg:w-[min(23rem,calc(100%-var(--sidebar-width)-2.5rem))]',
      )}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2.5 px-3.5 font-semibold text-foreground transition-colors outline-none marker:content-none hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset">
        <span className="flex size-6 items-center justify-center rounded-md border border-border bg-muted text-primary">
          <Keyboard className="size-3.5" aria-hidden="true" />
        </span>
        <span>Atajos de teclado</span>
        <span className="ml-auto text-[10px] font-medium tracking-[0.12em] text-muted-foreground uppercase">
          Ayuda
        </span>
      </summary>
      <dl className="grid grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-3 gap-y-3 border-t border-border px-3.5 py-3.5">
        <KeyboardShortcut keys={<Kbd>Tab</Kbd>}>
          Recorrer los controles y elementos del mapa.
        </KeyboardShortcut>
        <KeyboardShortcut
          keys={
            <KbdGroup className="flex-wrap">
              <Kbd aria-label="Enter">↵</Kbd>
              <span aria-hidden="true">/</span>
              <Kbd aria-label="Espacio">␣</Kbd>
            </KbdGroup>
          }
        >
          Activar el control o seleccionar el elemento enfocado.
        </KeyboardShortcut>
        <KeyboardShortcut keys={<Kbd aria-label="Escape">Esc</Kbd>}>
          Cerrar el detalle o panel del nodo seleccionado.
        </KeyboardShortcut>
        {isEditing ? (
          <KeyboardShortcut keys={<Kbd>Flechas</Kbd>}>
            Mover una cuadrícula el nodo seleccionado. <Kbd aria-label="Shift">⇧</Kbd> +{' '}
            <Kbd>Flechas</Kbd> lo desplaza 5 cuadrículas.
          </KeyboardShortcut>
        ) : null}
        {isEditing ? (
          <KeyboardShortcut
            keys={
              <KbdGroup className="flex-wrap">
                <Kbd aria-label="Suprimir">⌦</Kbd>
                <span aria-hidden="true">/</span>
                <Kbd aria-label="Retroceso">⌫</Kbd>
              </KbdGroup>
            }
          >
            Eliminar la dependencia seleccionada, con confirmación.
          </KeyboardShortcut>
        ) : null}
        <KeyboardShortcut
          keys={
            <div className="flex flex-col items-start gap-1">
              <KbdGroup className="w-fit flex-none">
                <Kbd aria-label="Comando">⌘</Kbd>
                <span aria-hidden="true">+</span>
                <Kbd>B</Kbd>
              </KbdGroup>
              <KbdGroup className="w-fit flex-none">
                <Kbd>Ctrl</Kbd>
                <span aria-hidden="true">+</span>
                <Kbd>B</Kbd>
              </KbdGroup>
            </div>
          }
        >
          Ocultar o mostrar el panel lateral.
        </KeyboardShortcut>
        <KeyboardShortcut
          keys={
            <KbdGroup className="flex-wrap">
              <Kbd>Inicio</Kbd>
              <span aria-hidden="true">/</span>
              <Kbd>Fin</Kbd>
            </KbdGroup>
          }
        >
          Con el borde del panel enfocado, establecer su ancho mínimo o máximo.
        </KeyboardShortcut>
      </dl>
    </details>
  );
}

function sameNodeDeletionImpact(first: NodeDeletionImpact, second: NodeDeletionImpact) {
  return (
    first.version === second.version &&
    first.node.title === second.node.title &&
    first.node.nodeType.name === second.node.nodeType.name &&
    first.node.nodeType.icon === second.node.nodeType.icon &&
    first.node.nodeType.color === second.node.nodeType.color &&
    first.dependencies.length === second.dependencies.length &&
    first.dependencies.every(
      (dependency, index) =>
        dependency.id === second.dependencies[index]?.id &&
        dependency.sourceTitle === second.dependencies[index]?.sourceTitle &&
        dependency.targetTitle === second.dependencies[index]?.targetTitle,
    ) &&
    first.resources.length === second.resources.length &&
    first.resources.every(
      (resource, index) =>
        resource.id === second.resources[index]?.id &&
        resource.title === second.resources[index]?.title,
    )
  );
}

export default function RoadmapCanvas({
  identifier,
  canEdit,
  canPreview,
  isHistorical,
  title,
  courseCode,
  year,
  semester,
}: Props) {
  const [canvasState, dispatchCanvas] = useReducer(canvasStateReducer, initialCanvasState);
  const {
    selectedNodeId,
    isEditorOpen,
    isStudentDetailOpen,
    restoreViewport,
    editorKey,
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    resourceComposerRequest,
  } = canvasState;
  const canvasMode = deriveCanvasMode({
    canEdit,
    canPreview,
    isHistorical,
    isCanvasPreview: canvasState.isCanvasPreview,
  });
  const { isHistorical: isHistoricalRoadmap, isCanvasPreview, isStudentExperience } = canvasMode;
  const { canEditRoadmap, canPreviewCanvas, canEnterCanvasPreview, canResetCanvasPreview } =
    canvasMode.capabilities;
  const [pendingSimpleConfirmation, setPendingSimpleConfirmation] =
    useState<PendingSimpleConfirmation | null>(null);
  const [pendingVisibilityChange, setPendingVisibilityChange] =
    useState<PendingVisibilityChange | null>(null);
  const [isVisibilityPreviewing, setIsVisibilityPreviewing] = useState(false);
  const [isVisibilityChanging, setIsVisibilityChanging] = useState(false);
  const [pendingNodeDeletion, setPendingNodeDeletion] = useState<PendingNodeDeletion | null>(null);
  const [isNodeDeletionPreviewing, setIsNodeDeletionPreviewing] = useState(false);
  const [isNodeDeleting, setIsNodeDeleting] = useState(false);
  const [successToast, setSuccessToast] = useState<{ id: number; message: string } | null>(null);
  const [pendingActionId, setPendingActionId] = useState<string>();
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const previewCanvasButtonRef = useRef<HTMLButtonElement | null>(null);
  const roadmapGraphRef = useRef<RoadmapGraphHandle>(null);
  const editorDraftRef = useRef<RoadmapEditorDraftHandle>(null);
  const lastViewportRef = useRef<Viewport | null>(null);
  const successToastIdRef = useRef(0);
  const {
    roadmap,
    error,
    dismissError,
    addNode,
    updateNode,
    moveNode,
    connectNodes,
    previewRoadmapDependency,
    previewTeacherBlock,
    changeTeacherBlock,
    deleteDependency,
    toggleVisibility,
    previewNodeVisibility,
    previewNodeDeletion,
    deleteNode,
    addResource,
    uploadResource,
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
    simulationRoadmap,
    loadSimulation,
    completeSimulatedNode,
    resetSimulation,
  } = useRoadmap(identifier);
  const dependencyWorkflow = useDependencyWorkflow({
    roadmap,
    connectNodes,
    previewRoadmapDependency,
    deleteDependency,
  });
  const teacherBlockWorkflow = useTeacherBlockWorkflow({
    roadmap,
    previewTeacherBlock,
    changeTeacherBlock,
  });
  const dismissSuccessToast = useCallback(() => setSuccessToast(null), []);

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast({ id: ++successToastIdRef.current, message });
  }, []);

  const updateNodeWithConfirmation = useCallback(
    async (...args: Parameters<typeof updateNode>) => {
      const succeeded = await updateNode(...args);
      if (succeeded) showSuccessToast('Cambios guardados exitosamente.');
      return succeeded;
    },
    [showSuccessToast, updateNode],
  );

  const addResourceWithConfirmation = useCallback(
    async (...args: Parameters<typeof addResource>) => {
      const succeeded = await addResource(...args);
      if (succeeded) showSuccessToast('Enlace guardado exitosamente.');
      return succeeded;
    },
    [addResource, showSuccessToast],
  );

  const updateResourceWithConfirmation = useCallback(
    async (...args: Parameters<typeof updateResource>) => {
      const succeeded = await updateResource(...args);
      if (succeeded) {
        showSuccessToast(
          args[1].type === 'LINK'
            ? 'Enlace guardado exitosamente.'
            : 'Recurso guardado exitosamente.',
        );
      }
      return succeeded;
    },
    [showSuccessToast, updateResource],
  );

  function closeSelectedNode() {
    dispatchCanvas({
      type: 'closeSelectedNode',
      panel: canEditRoadmap ? 'editor' : 'student',
    });
    requestAnimationFrame(() => selectedNodeTriggerRef.current?.focus());
  }

  function closeTeacherPreview() {
    dispatchCanvas({ type: 'closeTeacherPreview' });
    requestAnimationFrame(() => previewButtonRef.current?.focus());
  }

  async function enterCanvasPreview(discardDraft = false) {
    if (discardDraft) editorDraftRef.current?.reset();
    const loaded = await loadSimulation();
    if (!loaded) return;
    roadmapGraphRef.current?.closeActionMenus();
    dispatchCanvas({
      type: 'enterCanvasPreview',
      viewport: lastViewportRef.current,
      discardDraft,
    });
  }

  function requestCanvasPreview() {
    if (editorDraftRef.current?.isDirty) {
      setPendingSimpleConfirmation({ kind: 'discardCanvasPreviewDraft' });
      return;
    }
    void enterCanvasPreview();
  }

  function openResourceComposer(nodeId: string) {
    if (!canEditRoadmap || isCanvasPreview || pendingSimpleConfirmation) return;
    if (editorDraftRef.current?.isDirty && editorDraftRef.current.draftNodeId !== nodeId) {
      setPendingSimpleConfirmation({ kind: 'discardResourceDraft', nodeId });
      return;
    }
    dispatchCanvas({ type: 'openResourceComposer', nodeId });
  }

  function exitCanvasPreview() {
    dispatchCanvas({ type: 'exitCanvasPreview' });
    requestAnimationFrame(() => previewCanvasButtonRef.current?.focus());
  }

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canEditRoadmap && teacherPreviewNode) {
        event.preventDefault();
        closeTeacherPreview();
        return;
      }
      if (event.key === 'Escape' && canEditRoadmap && isEditorOpen && !isCanvasPreview) {
        event.preventDefault();
        dispatchCanvas({ type: 'closeEditor' });
        return;
      }
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && selectedNodeId) {
        event.preventDefault();
        if (canEditRoadmap && !isCanvasPreview) {
          if (!teacherPreviewNode) dispatchCanvas({ type: 'toggleEditor' });
        } else dispatchCanvas({ type: 'toggleStudentDetail' });
      }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [canEditRoadmap, isCanvasPreview, isEditorOpen, selectedNodeId, teacherPreviewNode]);

  async function requestVisibilityChange(nodeId: string, isVisible: boolean) {
    if (pendingVisibilityChange || isVisibilityPreviewing || isVisibilityChanging) return false;
    if (!isVisible) {
      setPendingVisibilityChange({ nodeId, isVisible, dependencies: [] });
      return false;
    }
    setIsVisibilityPreviewing(true);
    try {
      const dependencies = await previewNodeVisibility(nodeId);
      if (dependencies) setPendingVisibilityChange({ nodeId, isVisible, dependencies });
    } finally {
      setIsVisibilityPreviewing(false);
    }
    return false;
  }

  async function previewAndRequestNodeDeletion(nodeId: string) {
    if (pendingNodeDeletion || isNodeDeletionPreviewing || isNodeDeleting) return;
    setIsNodeDeletionPreviewing(true);
    try {
      const impact = await previewNodeDeletion(nodeId);
      if (impact) setPendingNodeDeletion({ nodeId, ...impact });
    } finally {
      setIsNodeDeletionPreviewing(false);
    }
  }

  function requestNodeDeletion(nodeId: string) {
    if (editorDraftRef.current?.isDirty && editorDraftRef.current.draftNodeId === nodeId) {
      setPendingSimpleConfirmation({ kind: 'discardNodeDraft', nodeId });
      return;
    }
    void previewAndRequestNodeDeletion(nodeId);
  }

  async function confirmNodeDeletion() {
    if (!pendingNodeDeletion || isNodeDeleting) return;
    setIsNodeDeleting(true);
    const latestImpact = await previewNodeDeletion(pendingNodeDeletion.nodeId);
    if (!latestImpact) {
      setIsNodeDeleting(false);
      return;
    }
    if (!sameNodeDeletionImpact(pendingNodeDeletion, latestImpact)) {
      setPendingNodeDeletion({ nodeId: pendingNodeDeletion.nodeId, ...latestImpact });
      setIsNodeDeleting(false);
      return;
    }
    const deleted = await deleteNode(pendingNodeDeletion.nodeId, pendingNodeDeletion.version);
    if (deleted) {
      editorDraftRef.current?.reset();
      dispatchCanvas({ type: 'closeSelectedNode', panel: 'editor' });
      setPendingNodeDeletion(null);
      setIsNodeDeleting(false);
      return;
    }
    const refreshedImpact = await previewNodeDeletion(pendingNodeDeletion.nodeId);
    if (refreshedImpact)
      setPendingNodeDeletion({ nodeId: pendingNodeDeletion.nodeId, ...refreshedImpact });
    setIsNodeDeleting(false);
  }

  function handleNodeDeletionAction(actionId: string) {
    if (actionId === roadmapConfirmationActionIds.deleteNode) void confirmNodeDeletion();
  }

  function handleVisibilityAction(actionId: string) {
    if (actionId === roadmapConfirmationActionIds.toggleVisibility) void confirmVisibilityChange();
  }

  async function confirmVisibilityChange() {
    if (!pendingVisibilityChange || isVisibilityChanging) return;
    setIsVisibilityChanging(true);
    const changed = await toggleVisibility(
      pendingVisibilityChange.nodeId,
      pendingVisibilityChange.isVisible,
    );
    if (changed) setPendingVisibilityChange(null);
    setIsVisibilityChanging(false);
  }

  function clearSimpleConfirmation() {
    setPendingActionId(undefined);
    setPendingSimpleConfirmation(null);
  }

  async function confirmSimulationReset() {
    if (pendingActionId) return;
    setPendingActionId(simpleConfirmationActionIds.resetSimulation);
    const succeeded = await resetSimulation();
    if (succeeded) clearSimpleConfirmation();
    else setPendingActionId(undefined);
  }

  function handleSimpleConfirmationAction(actionId: string) {
    const confirmation = pendingSimpleConfirmation;
    if (!confirmation || pendingActionId) return;

    if (actionId !== simpleConfirmationActionIds.discardDraft) {
      if (
        confirmation.kind === 'resetSimulation' &&
        actionId === simpleConfirmationActionIds.resetSimulation
      )
        void confirmSimulationReset();
      return;
    }

    if (confirmation.kind === 'discardNodeDraft') {
      editorDraftRef.current?.reset();
      clearSimpleConfirmation();
      void previewAndRequestNodeDeletion(confirmation.nodeId);
      return;
    }

    if (confirmation.kind === 'discardResourceDraft') {
      editorDraftRef.current?.reset();
      setPendingSimpleConfirmation(null);
      dispatchCanvas({ type: 'openResourceComposer', nodeId: confirmation.nodeId });
      setPendingActionId(undefined);
      return;
    }

    if (confirmation.kind === 'discardCanvasPreviewDraft') {
      clearSimpleConfirmation();
      void enterCanvasPreview(true);
    }
  }

  if (error && !roadmap) {
    return (
      <Alert variant="destructive" className="m-4 max-w-2xl">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Error al cargar el roadmap</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }
  if (!roadmap) {
    return (
      <Empty className="m-4 min-h-56 w-auto border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner aria-label="Cargando roadmap" className="motion-reduce:animate-none" />
          </EmptyMedia>
          <EmptyTitle>Cargando roadmap...</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }

  const displayedRoadmap = isCanvasPreview ? (simulationRoadmap ?? roadmap) : roadmap;
  const selectedNode = displayedRoadmap.nodes.find((node) => node.id === selectedNodeId);
  const addNodeAtViewport = (
    node: Parameters<typeof addNode>[0],
    viewport: { x: number; y: number; width: number; height: number },
  ) => {
    const size = roadmapNodeSizeForTitle(node.title);
    const position = findOpenRoadmapPosition(
      roadmap.nodes.map((roadmapNode) => ({
        x: roadmapNode.positionX,
        y: roadmapNode.positionY,
        ...roadmapNodeSizeForTitle(roadmapNode.title),
      })),
      {
        x: viewport.x + viewport.width / 2 - size.width / 2,
        y: viewport.y + viewport.height / 2 - size.height / 2,
      },
      size,
      viewport,
    );
    if (!position) return Promise.resolve(false);
    return addNode(node, position, (nodeId) =>
      dispatchCanvas({ type: 'selectCreatedNode', nodeId }),
    );
  };
  const visibilityDependencies = pendingVisibilityChange?.dependencies ?? [];
  const pendingVisibilityNode = pendingVisibilityChange
    ? roadmap.nodes.find((node) => node.id === pendingVisibilityChange.nodeId)
    : undefined;
  const isEditorPanelOpen = canvasMode.isEditing && isEditorOpen;
  const isStudentPanelOpen = Boolean(
    teacherPreviewNode ||
    (isStudentExperience &&
      isStudentDetailOpen &&
      selectedNode &&
      !isStudentBlockedNode(selectedNode)),
  );
  const isSidePanelOpen = isEditorPanelOpen || isStudentPanelOpen;
  const activePanelWidth =
    teacherPreviewNode || isEditorPanelOpen ? editorPanel.width : studentPanel.width;
  return (
    <SidebarProvider
      className="min-h-0 lg:h-full"
      style={
        {
          '--sidebar-width': `${activePanelWidth}px`,
        } as CSSProperties
      }
    >
      <section
        className={cn(
          'relative box-border grid min-h-[calc(100dvh-4rem)] min-w-0 flex-1 overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26/5%)] lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
          isSidePanelOpen ? 'lg:grid-cols-[minmax(0,1fr)_var(--sidebar-width)]' : 'lg:grid-cols-1',
        )}
      >
        <div
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[min(540px,calc(100dvh-4rem-2px))] bg-background lg:min-h-0"
        >
          <header className="pointer-events-none absolute top-4 left-4 z-4 max-w-[calc(100%-2rem)] sm:top-6 sm:left-6 sm:max-w-md">
            <div className="flex flex-wrap items-center gap-2">
              {canvasMode.isEditing ? <Badge variant="secondary">Modo edición</Badge> : null}
            </div>
            <h1 className="mt-2 font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] text-balance sm:text-[30px]">
              {title}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
              <span>{courseCode}</span>
              <span aria-hidden="true">·</span>
              <span>
                {semester === 1 ? 'Otoño' : 'Primavera'} {year}
              </span>
            </p>
          </header>
          {error && <RoadmapErrorToast message={error} onDismiss={dismissError} />}
          {successToast && (
            <RoadmapSuccessToast
              key={successToast.id}
              message={successToast.message}
              onDismiss={dismissSuccessToast}
            />
          )}
          {isCanvasPreview ? (
            <div className="pointer-events-auto absolute top-3 left-1/2 z-5 flex w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-xl border border-border bg-card/95 p-2 shadow-lg shadow-black/5 backdrop-blur-sm sm:w-auto sm:flex-nowrap">
              <p className="px-2 text-sm font-semibold text-foreground">
                Previsualización del canvas
              </p>
              {canResetCanvasPreview ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPendingSimpleConfirmation({ kind: 'resetSimulation' })}
                >
                  <RotateCcw data-icon="inline-start" />
                  Reiniciar progreso
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={exitCanvasPreview}>
                {isHistoricalRoadmap ? 'Volver al roadmap' : 'Ir al editor'}
              </Button>
            </div>
          ) : null}
          <RoadmapGraph
            ref={roadmapGraphRef}
            roadmap={displayedRoadmap}
            canEdit={canvasMode.isEditing}
            isTeacherView={!isStudentExperience}
            onSelectNode={(nodeId, trigger) => {
              const node = displayedRoadmap.nodes.find((candidate) => candidate.id === nodeId);
              if (isStudentExperience && isStudentBlockedNode(node)) return;
              selectedNodeTriggerRef.current = trigger;
              dispatchCanvas({
                type: 'selectNode',
                nodeId,
                panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
              });
            }}
            selectedNodeId={selectedNodeId}
            onMoveNode={(_event, node) => void moveNode(node.id, snapToRoadmapGrid(node.position))}
            onKeyboardNodeMove={(nodeId, position) =>
              void moveNode(nodeId, snapToRoadmapGrid(position))
            }
            onClearSelectedNode={closeSelectedNode}
            onConnectNodes={dependencyWorkflow.requestCreation}
            onDeleteDependencies={dependencyWorkflow.requestDeletion}
            onAutoLayout={(nodes) => {
              void Promise.all(
                nodes.map((node) => moveNode(node.id, snapToRoadmapGrid(node.position))),
              );
            }}
            onViewportChange={(viewport) => {
              lastViewportRef.current = viewport;
            }}
            restoreViewport={restoreViewport}
            onRequestAccessAction={(nodeId, operation) =>
              teacherBlockWorkflow.requestChange(nodeId, operation)
            }
            onRequestVisibilityAction={(nodeId, isVisible) =>
              void requestVisibilityChange(nodeId, isVisible)
            }
            onRequestAddResource={openResourceComposer}
            onRequestDelete={requestNodeDeletion}
            topRightActions={
              !isCanvasPreview && (canEditRoadmap || canPreviewCanvas)
                ? (getViewport) => (
                    <>
                      {canEditRoadmap ? (
                        <NodeCreator
                          nodeTypes={roadmap.nodeTypes}
                          onSubmit={(node) => addNodeAtViewport(node, getViewport())}
                          onCreateNodeType={addNodeType}
                          onUpdateNodeType={updateNodeType}
                          onDeleteNodeType={deleteNodeType}
                        />
                      ) : null}
                      {canEnterCanvasPreview ? (
                        <Button
                          ref={previewCanvasButtonRef}
                          aria-label="Previsualizar canvas"
                          title="Previsualizar canvas"
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={requestCanvasPreview}
                        >
                          <Eye />
                        </Button>
                      ) : null}
                      {canEditRoadmap && selectedNode ? (
                        <Button
                          aria-label={
                            isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'
                          }
                          title={
                            isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'
                          }
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => dispatchCanvas({ type: 'toggleEditor' })}
                        >
                          {isEditorOpen ? <PanelRightClose /> : <PanelRightOpen />}
                        </Button>
                      ) : null}
                    </>
                  )
                : undefined
            }
          />
        </div>
        <KeyboardShortcuts isEditing={canvasMode.isEditing} isSidePanelOpen={isSidePanelOpen} />
        {canEditRoadmap && (
          <RoadmapEditor
            key={editorKey + ':' + (selectedNode?.id ?? 'none')}
            roadmap={roadmap as RoadmapDto}
            selectedNode={selectedNode as RoadmapNode | undefined}
            ref={editorDraftRef}
            isVisibilityPending={isVisibilityPreviewing || isVisibilityChanging}
            isOpen={canvasMode.isEditing && isEditorOpen}
            resourceComposerRequest={resourceComposerRequest}
            onClose={closeSelectedNode}
            onUpdateNode={updateNodeWithConfirmation}
            onToggleVisibility={requestVisibilityChange}
            onRequestTeacherBlock={(nodeId, operation) =>
              teacherBlockWorkflow.requestChange(nodeId, operation)
            }
            onDeleteNode={deleteNode}
            onAddResource={addResourceWithConfirmation}
            onUploadResource={uploadResource}
            onUpdateResource={updateResourceWithConfirmation}
            onDeleteResource={deleteResource}
            onPreview={(node) => {
              dispatchCanvas({ type: 'showTeacherPreview', node });
            }}
            previewButtonRef={previewButtonRef}
            panelWidth={editorPanel.width}
            onPanelWidthChange={editorPanel.setWidth}
          />
        )}
        {(isStudentExperience || teacherPreviewNode) && (
          <StudentNodeDetail
            node={
              teacherPreviewNode ??
              (isStudentDetailOpen ? (selectedNode as StudentRoadmapNode | undefined) : undefined)
            }
            status={
              teacherPreviewNode
                ? isTeacherPreviewCompleted
                  ? 'completed'
                  : 'available'
                : isStudentDetailOpen && selectedNode
                  ? studentNodeStatus(selectedNode)
                  : null
            }
            onClose={teacherPreviewNode ? closeTeacherPreview : closeSelectedNode}
            onComplete={(node) => {
              if (isCanvasPreview && !isHistoricalRoadmap) void completeSimulatedNode(node.id);
              else if (teacherPreviewNode) dispatchCanvas({ type: 'completeTeacherPreview' });
              else void completeNode(node.id);
            }}
            isReadOnly={isHistoricalRoadmap && !teacherPreviewNode}
            nodeTypes={roadmap.nodeTypes}
            panelWidth={teacherPreviewNode ? editorPanel.width : studentPanel.width}
            onPanelWidthChange={teacherPreviewNode ? editorPanel.setWidth : studentPanel.setWidth}
          />
        )}
      </section>
      <ConfirmationDialog
        confirmation={
          pendingNodeDeletion
            ? nodeDeletionConfirmation({
                nodeId: pendingNodeDeletion.nodeId,
                node: pendingNodeDeletion.node,
                dependencies: pendingNodeDeletion.dependencies,
                resources: pendingNodeDeletion.resources,
              })
            : null
        }
        pendingActionId={isNodeDeleting ? roadmapConfirmationActionIds.deleteNode : undefined}
        onCancel={() => {
          if (!isNodeDeleting) setPendingNodeDeletion(null);
        }}
        onAction={handleNodeDeletionAction}
      />
      <ConfirmationDialog
        confirmation={
          pendingSimpleConfirmation
            ? simpleConfirmationPresentation(pendingSimpleConfirmation)
            : null
        }
        pendingActionId={pendingActionId}
        onCancel={clearSimpleConfirmation}
        onAction={handleSimpleConfirmationAction}
      />
      <ConfirmationDialog {...dependencyWorkflow.deletionDialog} />
      <ConfirmationDialog
        confirmation={
          pendingVisibilityChange && pendingVisibilityNode
            ? roadmapNodeVisibilityConfirmation(
                roadmap,
                pendingVisibilityNode,
                pendingVisibilityChange.isVisible,
                visibilityDependencies,
              )
            : null
        }
        pendingActionId={
          isVisibilityChanging ? roadmapConfirmationActionIds.toggleVisibility : undefined
        }
        onCancel={() => {
          if (!isVisibilityChanging) setPendingVisibilityChange(null);
        }}
        onAction={handleVisibilityAction}
      />
      <ConfirmationDialog {...dependencyWorkflow.creationDialog} />
      <ConfirmationDialog {...teacherBlockWorkflow.confirmationDialog} />
    </SidebarProvider>
  );
}
