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
  ArrowRight,
  CircleAlert,
  Eye,
  EyeOff,
  Keyboard,
  PanelRightClose,
  PanelRightOpen,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import type { Viewport } from '@xyflow/react';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { RoadmapGraph, type RoadmapGraphHandle } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import {
  useRoadmap,
  type StructuralDependency,
  type TeacherBlockImpact,
  type TeacherBlockPreview,
} from '@/features/roadmap/useRoadmap';
import type {
  CourseOfferingIdentifier,
  NodeDeletionImpact,
  RoadmapDto,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
  StudentRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { RoadmapEditorDraftHandle } from '@/features/roadmap/editor/types';
import {
  findOpenRoadmapPosition,
  roadmapNodeSizeForTitle,
  snapToRoadmapGrid,
} from '@/features/roadmap/graph/geometry';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/alert-dialog';
import { ConfirmationDialog, type ConfirmationPresentation } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { Kbd, KbdGroup } from '@/shared/ui/kbd';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { NodeTypeIcon } from '@/features/roadmap/node-type-icon-registry';
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

type PendingDependencyChange = {
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  nodes: TeacherBlockImpact[];
};

type PendingTeacherBlockChange = {
  nodeId: string;
  operation: TeacherBlockOperation;
} & TeacherBlockPreview;

type PendingNodeDeletion = { nodeId: string } & NodeDeletionImpact;

type PendingSimpleConfirmation =
  | { kind: 'deleteDependencies'; dependencyIds: string[] }
  | { kind: 'discardNodeDraft'; nodeId: string }
  | { kind: 'discardResourceDraft'; nodeId: string }
  | { kind: 'discardCanvasPreviewDraft' }
  | { kind: 'resetSimulation' };

const simpleConfirmationActionIds = {
  deleteDependencies: 'delete-dependencies',
  discardDraft: 'discard-draft',
  resetSimulation: 'reset-simulation',
} as const;

function simpleConfirmationPresentation(
  confirmation: PendingSimpleConfirmation,
): ConfirmationPresentation {
  switch (confirmation.kind) {
    case 'deleteDependencies': {
      const dependencyLabel =
        confirmation.dependencyIds.length === 1 ? 'esta dependencia' : 'estas dependencias';

      return {
        title: 'Confirmar eliminación',
        description: `Eliminarás ${dependencyLabel}. Esta acción no se puede deshacer.`,
        intent: 'destructive',
        actions: [{ id: simpleConfirmationActionIds.deleteDependencies, label: 'Eliminar' }],
      };
    }
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

type PreviewReturnState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  viewport: Viewport | null;
};

type CanvasState = {
  selectedNodeId: string | null;
  isEditorOpen: boolean;
  isStudentDetailOpen: boolean;
  isCanvasPreview: boolean;
  previewReturnState: PreviewReturnState | null;
  restoreViewport: Viewport | null;
  editorKey: number;
  teacherPreviewNode: StudentAccessibleRoadmapNode | null;
  isTeacherPreviewCompleted: boolean;
  pendingSimpleConfirmation: PendingSimpleConfirmation | null;
  pendingVisibilityChange: PendingVisibilityChange | null;
  isVisibilityPreviewing: boolean;
  isVisibilityChanging: boolean;
  pendingDependencyChange: PendingDependencyChange | null;
  pendingTeacherBlockChange: PendingTeacherBlockChange | null;
  isTeacherBlockChanging: boolean;
  pendingNodeDeletion: PendingNodeDeletion | null;
  isNodeDeletionPreviewing: boolean;
  isNodeDeleting: boolean;
  resourceComposerRequest: number;
};

type CanvasStateAction =
  | { type: 'closeSelectedNode'; canEdit: boolean }
  | { type: 'closeTeacherPreview' }
  | { type: 'enterCanvasPreview'; viewport: Viewport | null; discardDraft: boolean }
  | { type: 'exitCanvasPreview' }
  | {
      type: 'selectNode';
      nodeId: string;
      isStudentExperience: boolean;
      canEdit: boolean;
    }
  | { type: 'showTeacherPreview'; node: StudentAccessibleRoadmapNode }
  | { type: 'completeTeacherPreview' }
  | { type: 'toggleEditor' }
  | { type: 'toggleStudentDetail' }
  | { type: 'update'; update: Partial<CanvasState> };

const initialCanvasState: CanvasState = {
  selectedNodeId: null,
  isEditorOpen: false,
  isStudentDetailOpen: false,
  isCanvasPreview: false,
  previewReturnState: null,
  restoreViewport: null,
  editorKey: 0,
  teacherPreviewNode: null,
  isTeacherPreviewCompleted: false,
  pendingSimpleConfirmation: null,
  pendingVisibilityChange: null,
  isVisibilityPreviewing: false,
  isVisibilityChanging: false,
  pendingDependencyChange: null,
  pendingTeacherBlockChange: null,
  isTeacherBlockChanging: false,
  pendingNodeDeletion: null,
  isNodeDeletionPreviewing: false,
  isNodeDeleting: false,
  resourceComposerRequest: 0,
};

function canvasStateReducer(state: CanvasState, action: CanvasStateAction): CanvasState {
  switch (action.type) {
    case 'closeSelectedNode':
      return {
        ...state,
        selectedNodeId: null,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        ...(action.canEdit ? { isEditorOpen: false } : { isStudentDetailOpen: false }),
      };
    case 'closeTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isEditorOpen: true,
      };
    case 'enterCanvasPreview':
      return {
        ...state,
        editorKey: action.discardDraft ? state.editorKey + 1 : state.editorKey,
        restoreViewport: null,
        previewReturnState: {
          selectedNodeId: state.selectedNodeId,
          isEditorOpen: state.isEditorOpen,
          isStudentDetailOpen: state.isStudentDetailOpen,
          viewport: action.viewport,
        },
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        isStudentDetailOpen: false,
        isEditorOpen: false,
        selectedNodeId: null,
        isCanvasPreview: true,
      };
    case 'exitCanvasPreview': {
      const previous = state.previewReturnState;
      return {
        ...state,
        isCanvasPreview: false,
        selectedNodeId: previous?.selectedNodeId ?? null,
        isEditorOpen: previous?.isEditorOpen ?? false,
        isStudentDetailOpen: previous?.isStudentDetailOpen ?? false,
        restoreViewport: previous?.viewport ?? null,
        previewReturnState: null,
      };
    }
    case 'selectNode':
      return {
        ...state,
        selectedNodeId: action.nodeId,
        ...(action.isStudentExperience
          ? { isStudentDetailOpen: true }
          : action.canEdit
            ? {
                teacherPreviewNode: null,
                isTeacherPreviewCompleted: false,
                isEditorOpen: true,
              }
            : {}),
      };
    case 'showTeacherPreview':
      return {
        ...state,
        teacherPreviewNode: action.node,
        isTeacherPreviewCompleted: false,
        isEditorOpen: false,
      };
    case 'completeTeacherPreview':
      return { ...state, isTeacherPreviewCompleted: true };
    case 'toggleEditor':
      return { ...state, isEditorOpen: !state.isEditorOpen };
    case 'toggleStudentDetail':
      return { ...state, isStudentDetailOpen: !state.isStudentDetailOpen };
    case 'update':
      return { ...state, ...action.update };
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
  canEdit,
  isCanvasPreview,
  isSidePanelOpen,
}: {
  canEdit: boolean;
  isCanvasPreview: boolean;
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
        {canEdit && !isCanvasPreview ? (
          <KeyboardShortcut keys={<Kbd>Flechas</Kbd>}>
            Mover una cuadrícula el nodo seleccionado. <Kbd aria-label="Shift">⇧</Kbd> +{' '}
            <Kbd>Flechas</Kbd> lo desplaza 5 cuadrículas.
          </KeyboardShortcut>
        ) : null}
        {canEdit && !isCanvasPreview ? (
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

function teacherBlockConfirmation(
  operation: TeacherBlockOperation,
  mode: TeacherBlockPreview['mode'],
  count: number,
) {
  const nodes = count === 1 ? 'nodo' : 'nodos';
  if (mode === 'BLOCK') {
    return {
      title: 'Confirmar bloqueo de rama',
      description: `Bloquearás ${count} ${nodes}.`,
      action: 'Bloquear rama',
    };
  }
  if (mode === 'UPSTREAM') {
    return {
      title: 'Desbloquear prerrequisitos',
      description: `Desbloquearás ${count} ${nodes}, incluidos los prerrequisitos bloqueados.`,
      action: `Desbloquear ${count} ${nodes}`,
    };
  }
  if (mode === 'SINGLE') {
    return {
      title: 'Confirmar desbloqueo',
      description: `Desbloquearás ${count} ${nodes}.`,
      action: 'Desbloquear este nodo',
    };
  }
  return {
    title: 'Confirmar desbloqueo de rama',
    description: `Desbloquearás ${count} ${nodes} elegibles de la rama.`,
    action: 'Desbloquear rama',
  };
}

function sameTeacherBlockPreview(first: TeacherBlockPreview, second: TeacherBlockPreview) {
  return (
    first.mode === second.mode &&
    first.version === second.version &&
    first.nodes.length === second.nodes.length &&
    first.nodes.every(
      (node, index) =>
        node.id === second.nodes[index]?.id &&
        node.title === second.nodes[index]?.title &&
        node.relation === second.nodes[index]?.relation &&
        node.nodeType?.name === second.nodes[index]?.nodeType?.name &&
        node.nodeType?.icon === second.nodes[index]?.nodeType?.icon &&
        node.nodeType?.color === second.nodes[index]?.nodeType?.color,
    )
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
        resource.id === second.resources[index]?.id && resource.title === second.resources[index]?.title,
    )
  );
}

export default function RoadmapCanvas({
  identifier,
  canEdit = false,
  canPreview = canEdit,
  isHistorical = false,
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
    isCanvasPreview,
    restoreViewport,
    editorKey,
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    pendingSimpleConfirmation,
    pendingVisibilityChange,
    isVisibilityPreviewing,
    isVisibilityChanging,
    pendingDependencyChange,
    pendingTeacherBlockChange,
    isTeacherBlockChanging,
    pendingNodeDeletion,
    isNodeDeletionPreviewing,
    isNodeDeleting,
    resourceComposerRequest,
  } = canvasState;
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
    dispatchCanvas({ type: 'closeSelectedNode', canEdit });
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
      dispatchCanvas({
        type: 'update',
        update: { pendingSimpleConfirmation: { kind: 'discardCanvasPreviewDraft' } },
      });
      return;
    }
    void enterCanvasPreview();
  }

  function openResourceComposer(nodeId: string) {
    if (!canEdit || isCanvasPreview || pendingSimpleConfirmation) return;
    if (editorDraftRef.current?.isDirty && editorDraftRef.current.draftNodeId !== nodeId) {
      dispatchCanvas({
        type: 'update',
        update: { pendingSimpleConfirmation: { kind: 'discardResourceDraft', nodeId } },
      });
      return;
    }
    dispatchCanvas({
      type: 'update',
      update: {
        selectedNodeId: nodeId,
        isEditorOpen: true,
        teacherPreviewNode: null,
        isTeacherPreviewCompleted: false,
        resourceComposerRequest: resourceComposerRequest + 1,
      },
    });
  }

  function exitCanvasPreview() {
    dispatchCanvas({ type: 'exitCanvasPreview' });
    requestAnimationFrame(() => previewCanvasButtonRef.current?.focus());
  }

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canEdit && teacherPreviewNode) {
        event.preventDefault();
        closeTeacherPreview();
        return;
      }
      if (event.key === 'Escape' && canEdit && isEditorOpen && !isCanvasPreview) {
        event.preventDefault();
        dispatchCanvas({ type: 'update', update: { isEditorOpen: false } });
        return;
      }
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && selectedNodeId) {
        event.preventDefault();
        if (canEdit && !isCanvasPreview) {
          if (!teacherPreviewNode) dispatchCanvas({ type: 'toggleEditor' });
        } else dispatchCanvas({ type: 'toggleStudentDetail' });
      }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [canEdit, isCanvasPreview, isEditorOpen, selectedNodeId, teacherPreviewNode]);

  async function requestVisibilityChange(nodeId: string, isVisible: boolean) {
    if (pendingVisibilityChange || isVisibilityPreviewing || isVisibilityChanging) return false;
    if (!isVisible) {
      dispatchCanvas({
        type: 'update',
        update: { pendingVisibilityChange: { nodeId, isVisible, dependencies: [] } },
      });
      return false;
    }
    dispatchCanvas({ type: 'update', update: { isVisibilityPreviewing: true } });
    try {
      const dependencies = await previewNodeVisibility(nodeId);
      if (dependencies)
        dispatchCanvas({
          type: 'update',
          update: { pendingVisibilityChange: { nodeId, isVisible, dependencies } },
        });
    } finally {
      dispatchCanvas({
        type: 'update',
        update: { isVisibilityPreviewing: false },
      });
    }
    return false;
  }

  async function previewAndRequestNodeDeletion(nodeId: string) {
    if (pendingNodeDeletion || isNodeDeletionPreviewing || isNodeDeleting) return;
    dispatchCanvas({ type: 'update', update: { isNodeDeletionPreviewing: true } });
    try {
      const impact = await previewNodeDeletion(nodeId);
      if (impact)
        dispatchCanvas({
          type: 'update',
          update: { pendingNodeDeletion: { nodeId, ...impact } },
        });
    } finally {
      dispatchCanvas({ type: 'update', update: { isNodeDeletionPreviewing: false } });
    }
  }

  function requestNodeDeletion(nodeId: string) {
    if (editorDraftRef.current?.isDirty && editorDraftRef.current.draftNodeId === nodeId) {
      dispatchCanvas({
        type: 'update',
        update: { pendingSimpleConfirmation: { kind: 'discardNodeDraft', nodeId } },
      });
      return;
    }
    void previewAndRequestNodeDeletion(nodeId);
  }

  async function confirmNodeDeletion() {
    if (!pendingNodeDeletion || isNodeDeleting) return;
    dispatchCanvas({ type: 'update', update: { isNodeDeleting: true } });
    const latestImpact = await previewNodeDeletion(pendingNodeDeletion.nodeId);
    if (!latestImpact) {
      dispatchCanvas({ type: 'update', update: { isNodeDeleting: false } });
      return;
    }
    if (!sameNodeDeletionImpact(pendingNodeDeletion, latestImpact)) {
      dispatchCanvas({
        type: 'update',
        update: {
          pendingNodeDeletion: { nodeId: pendingNodeDeletion.nodeId, ...latestImpact },
          isNodeDeleting: false,
        },
      });
      return;
    }
    const deleted = await deleteNode(pendingNodeDeletion.nodeId, pendingNodeDeletion.version);
    if (deleted) {
      editorDraftRef.current?.reset();
      dispatchCanvas({
        type: 'update',
        update: {
          selectedNodeId: null,
          isEditorOpen: false,
          pendingNodeDeletion: null,
          isNodeDeleting: false,
        },
      });
      return;
    }
    const refreshedImpact = await previewNodeDeletion(pendingNodeDeletion.nodeId);
    dispatchCanvas({
      type: 'update',
      update: {
        ...(refreshedImpact
          ? { pendingNodeDeletion: { nodeId: pendingNodeDeletion.nodeId, ...refreshedImpact } }
          : {}),
        isNodeDeleting: false,
      },
    });
  }

  async function confirmVisibilityChange() {
    if (!pendingVisibilityChange || isVisibilityChanging) return;
    dispatchCanvas({ type: 'update', update: { isVisibilityChanging: true } });
    const changed = await toggleVisibility(
      pendingVisibilityChange.nodeId,
      pendingVisibilityChange.isVisible,
    );
    dispatchCanvas({
      type: 'update',
      update: {
        isVisibilityChanging: false,
        ...(changed ? { pendingVisibilityChange: null } : {}),
      },
    });
  }

  async function requestDependencyChange({
    source,
    target,
    sourceHandle,
    targetHandle,
  }: {
    source: string | null;
    target: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  }) {
    if (!source || !target) return;
    const nodes = await previewRoadmapDependency(
      source,
      target,
      sourceHandle ?? undefined,
      targetHandle ?? undefined,
    );
    if (!nodes) return;
    if (nodes.length === 0) {
      void connectNodes(source, target, sourceHandle ?? undefined, targetHandle ?? undefined);
      return;
    }
    dispatchCanvas({
      type: 'update',
      update: {
        pendingDependencyChange: {
          sourceNodeId: source,
          targetNodeId: target,
          sourceHandle: sourceHandle ?? undefined,
          targetHandle: targetHandle ?? undefined,
          nodes,
        },
      },
    });
  }

  async function requestTeacherBlockChange(nodeId: string, operation: TeacherBlockOperation) {
    const preview = await previewTeacherBlock(nodeId, operation);
    if (preview)
      dispatchCanvas({
        type: 'update',
        update: { pendingTeacherBlockChange: { nodeId, operation, ...preview } },
      });
  }

  async function confirmTeacherBlockChange() {
    if (!pendingTeacherBlockChange || isTeacherBlockChanging) return;
    dispatchCanvas({ type: 'update', update: { isTeacherBlockChanging: true } });
    const latestPreview = await previewTeacherBlock(
      pendingTeacherBlockChange.nodeId,
      pendingTeacherBlockChange.operation,
    );
    if (!latestPreview) {
      dispatchCanvas({
        type: 'update',
        update: { pendingTeacherBlockChange: null, isTeacherBlockChanging: false },
      });
      return;
    }
    if (!sameTeacherBlockPreview(pendingTeacherBlockChange, latestPreview)) {
      dispatchCanvas({
        type: 'update',
        update: {
          pendingTeacherBlockChange: { ...pendingTeacherBlockChange, ...latestPreview },
          isTeacherBlockChanging: false,
        },
      });
      return;
    }
    dispatchCanvas({ type: 'update', update: { pendingTeacherBlockChange: null } });
    const changed = await changeTeacherBlock(
      pendingTeacherBlockChange.nodeId,
      pendingTeacherBlockChange.operation,
      pendingTeacherBlockChange.version,
    );
    if (!changed) {
      const refreshedPreview = await previewTeacherBlock(
        pendingTeacherBlockChange.nodeId,
        pendingTeacherBlockChange.operation,
      );
      if (refreshedPreview) {
        dispatchCanvas({
          type: 'update',
          update: {
            pendingTeacherBlockChange: {
              nodeId: pendingTeacherBlockChange.nodeId,
              operation: pendingTeacherBlockChange.operation,
              ...refreshedPreview,
            },
          },
        });
      }
    }
    dispatchCanvas({ type: 'update', update: { isTeacherBlockChanging: false } });
  }

  function clearSimpleConfirmation() {
    setPendingActionId(undefined);
    dispatchCanvas({ type: 'update', update: { pendingSimpleConfirmation: null } });
  }

  async function confirmDependencyDeletion(dependencyIds: string[]) {
    if (pendingActionId) return;
    setPendingActionId(simpleConfirmationActionIds.deleteDependencies);
    await Promise.allSettled(dependencyIds.map((dependencyId) => deleteDependency(dependencyId)));
    clearSimpleConfirmation();
  }

  async function confirmSimulationReset() {
    if (pendingActionId) return;
    setPendingActionId(simpleConfirmationActionIds.resetSimulation);
    await resetSimulation();
    clearSimpleConfirmation();
  }

  function handleSimpleConfirmationAction(actionId: string) {
    const confirmation = pendingSimpleConfirmation;
    if (!confirmation || pendingActionId) return;

    if (
      confirmation.kind === 'deleteDependencies' &&
      actionId === simpleConfirmationActionIds.deleteDependencies
    ) {
      void confirmDependencyDeletion(confirmation.dependencyIds);
      return;
    }

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
      dispatchCanvas({
        type: 'update',
        update: {
          pendingSimpleConfirmation: null,
          selectedNodeId: confirmation.nodeId,
          isEditorOpen: true,
          resourceComposerRequest: resourceComposerRequest + 1,
        },
      });
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
  const isReadOnlyTeacher = canPreview && !canEdit;
  const isStudentExperience = (!canEdit && !isReadOnlyTeacher) || isCanvasPreview;
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
      dispatchCanvas({ type: 'update', update: { selectedNodeId: nodeId } }),
    );
  };
  const teacherBlockDialog = pendingTeacherBlockChange
    ? teacherBlockConfirmation(
        pendingTeacherBlockChange.operation,
        pendingTeacherBlockChange.mode,
        pendingTeacherBlockChange.nodes.length,
      )
    : null;
  const visibilityDependencies = pendingVisibilityChange?.dependencies ?? [];
  const hasVisibilityDependencies = visibilityDependencies.length > 0;
  const isEditorPanelOpen = canEdit && isEditorOpen && !isCanvasPreview;
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
              {canEdit && !isCanvasPreview ? <Badge variant="secondary">Modo edición</Badge> : null}
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
              {!isHistorical ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    dispatchCanvas({
                      type: 'update',
                      update: { pendingSimpleConfirmation: { kind: 'resetSimulation' } },
                    })
                  }
                >
                  <RotateCcw data-icon="inline-start" />
                  Reiniciar progreso
                </Button>
              ) : null}
              <Button type="button" size="sm" onClick={exitCanvasPreview}>
                {isHistorical ? 'Volver al roadmap' : 'Ir al editor'}
              </Button>
            </div>
          ) : null}
          <RoadmapGraph
            ref={roadmapGraphRef}
            roadmap={displayedRoadmap}
            canEdit={canEdit && !isCanvasPreview}
            isTeacherView={!isStudentExperience}
            onSelectNode={(nodeId, trigger) => {
              const node = displayedRoadmap.nodes.find((candidate) => candidate.id === nodeId);
              if (isStudentExperience && isStudentBlockedNode(node)) return;
              selectedNodeTriggerRef.current = trigger;
              dispatchCanvas({ type: 'selectNode', nodeId, isStudentExperience, canEdit });
            }}
            selectedNodeId={selectedNodeId}
            onMoveNode={(_event, node) => void moveNode(node.id, snapToRoadmapGrid(node.position))}
            onKeyboardNodeMove={(nodeId, position) =>
              void moveNode(nodeId, snapToRoadmapGrid(position))
            }
            onClearSelectedNode={closeSelectedNode}
            onConnectNodes={(connection) => void requestDependencyChange(connection)}
            onDeleteDependencies={(dependencyIds) =>
              dispatchCanvas({
                type: 'update',
                update: {
                  pendingSimpleConfirmation: {
                    kind: 'deleteDependencies',
                    dependencyIds: [...dependencyIds],
                  },
                },
              })
            }
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
              void requestTeacherBlockChange(nodeId, operation)
            }
            onRequestVisibilityAction={(nodeId, isVisible) =>
              void requestVisibilityChange(nodeId, isVisible)
            }
            onRequestAddResource={openResourceComposer}
            onRequestDelete={requestNodeDeletion}
            topRightActions={
              !isCanvasPreview && (canEdit || canPreview)
                ? (getViewport) => (
                    <>
                      {canEdit ? (
                        <NodeCreator
                          nodeTypes={roadmap.nodeTypes}
                          onSubmit={(node) => addNodeAtViewport(node, getViewport())}
                          onCreateNodeType={addNodeType}
                          onUpdateNodeType={updateNodeType}
                          onDeleteNodeType={deleteNodeType}
                        />
                      ) : null}
                      {canPreview ? (
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
                      {canEdit && selectedNode ? (
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
        <KeyboardShortcuts
          canEdit={canEdit}
          isCanvasPreview={isCanvasPreview}
          isSidePanelOpen={isSidePanelOpen}
        />
        {canEdit && (
          <RoadmapEditor
            key={editorKey + ':' + (selectedNode?.id ?? 'none')}
            roadmap={roadmap as RoadmapDto}
            selectedNode={selectedNode as RoadmapNode | undefined}
            ref={editorDraftRef}
            isVisibilityPending={isVisibilityPreviewing || isVisibilityChanging}
            isOpen={isEditorOpen && !isCanvasPreview}
            resourceComposerRequest={resourceComposerRequest}
            onClose={closeSelectedNode}
            onUpdateNode={updateNodeWithConfirmation}
            onToggleVisibility={requestVisibilityChange}
            onRequestTeacherBlock={(nodeId, operation) =>
              void requestTeacherBlockChange(nodeId, operation)
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
              if (isCanvasPreview && !isHistorical) void completeSimulatedNode(node.id);
              else if (teacherPreviewNode) dispatchCanvas({ type: 'completeTeacherPreview' });
              else void completeNode(node.id);
            }}
            isReadOnly={isHistorical && !teacherPreviewNode}
            nodeTypes={roadmap.nodeTypes}
            panelWidth={teacherPreviewNode ? editorPanel.width : studentPanel.width}
            onPanelWidthChange={teacherPreviewNode ? editorPanel.setWidth : studentPanel.setWidth}
          />
        )}
      </section>
      <AlertDialog
        open={Boolean(pendingNodeDeletion)}
        onOpenChange={(open) => {
          if (!open && !isNodeDeleting)
            dispatchCanvas({ type: 'update', update: { pendingNodeDeletion: null } });
        }}
      >
        <AlertDialogContent className="gap-5 sm:max-w-xl">
          <AlertDialogHeader className="items-stretch gap-4 text-left">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive ring-1 ring-destructive/20"
              >
                <NodeTypeIcon
                  icon={pendingNodeDeletion?.node.nodeType.icon ?? 'Shapes'}
                  className="size-5"
                  style={{ color: pendingNodeDeletion?.node.nodeType.color }}
                />
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                  Eliminar Nodo
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  Eliminarás{' '}
                  <span className="font-semibold text-foreground">
                    {pendingNodeDeletion?.node.title}
                  </span>{' '}
                  y sus elementos relacionados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {pendingNodeDeletion ? (
            <div className="flex flex-col gap-5">
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <NodeTypeIcon
                  icon={pendingNodeDeletion.node.nodeType.icon}
                  className="size-4"
                  style={{ color: pendingNodeDeletion.node.nodeType.color }}
                  aria-label={pendingNodeDeletion.node.nodeType.name}
                />
                {pendingNodeDeletion.node.nodeType.name}
              </p>
              <section
                aria-labelledby="node-deletion-dependencies-heading"
                className="flex flex-col gap-2.5"
              >
                <h3
                  id="node-deletion-dependencies-heading"
                  className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  Dependencias relacionadas
                </h3>
                {pendingNodeDeletion.dependencies.length ? (
                  <ul
                    className="divide-y divide-border border-t border-border"
                    aria-label="Dependencias relacionadas"
                  >
                    {pendingNodeDeletion.dependencies.map((dependency) => (
                      <li
                        key={dependency.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-3 text-sm font-medium text-foreground"
                      >
                        <span>{dependency.sourceTitle}</span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 text-destructive"
                        />
                        <span>{dependency.targetTitle}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No hay Dependencias relacionadas.
                  </p>
                )}
              </section>
              <section
                aria-labelledby="node-deletion-resources-heading"
                className="flex flex-col gap-2.5"
              >
                <h3
                  id="node-deletion-resources-heading"
                  className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
                >
                  Recursos que se eliminarán
                </h3>
                {pendingNodeDeletion.resources.length ? (
                  <ul
                    className="divide-y divide-border border-t border-border"
                    aria-label="Recursos que se eliminarán"
                  >
                    {pendingNodeDeletion.resources.map((resource) => (
                      <li key={resource.id} className="py-2 text-sm font-medium text-foreground">
                        {resource.title}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No hay Recursos relacionados.</p>
                )}
              </section>
            </div>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isNodeDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              disabled={isNodeDeleting}
              onClick={() => void confirmNodeDeletion()}
            >
              <Trash2 data-icon="inline-start" />
              Eliminar Nodo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
      <AlertDialog
        open={Boolean(pendingVisibilityChange)}
        onOpenChange={(open) => {
          if (!open && !isVisibilityChanging)
            dispatchCanvas({ type: 'update', update: { pendingVisibilityChange: null } });
        }}
      >
        <AlertDialogContent className="gap-5 sm:max-w-xl">
          <AlertDialogHeader className="items-stretch gap-4 text-left sm:items-stretch">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border"
              >
                {pendingVisibilityChange?.isVisible ? (
                  <EyeOff className="size-5 text-muted-foreground" />
                ) : (
                  <Eye className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="flex min-w-0 flex-col gap-1">
                <AlertDialogTitle className="text-xl font-semibold tracking-tight">
                  {pendingVisibilityChange?.isVisible
                    ? 'Confirmar ocultación'
                    : 'Confirmar publicación'}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  {!pendingVisibilityChange?.isVisible ? (
                    'Este Nodo se mostrará al estudiantado y quedará disponible inmediatamente. No tendrá Dependencias ni Bloqueo docente.'
                  ) : hasVisibilityDependencies ? (
                    <>
                      El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo
                      docente y se eliminarán{' '}
                      <span className="font-semibold text-destructive">
                        {visibilityDependencies.length}{' '}
                        {visibilityDependencies.length === 1
                          ? 'dependencia relacionada'
                          : 'dependencias relacionadas'}
                      </span>
                      .
                    </>
                  ) : (
                    'El Nodo desaparecerá del Roadmap del estudiantado, se quitará su Bloqueo docente y no posee Dependencias.'
                  )}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {pendingVisibilityChange?.isVisible && hasVisibilityDependencies ? (
            <section
              aria-labelledby="removed-dependencies-heading"
              className="flex flex-col gap-2.5"
            >
              <h3
                id="removed-dependencies-heading"
                className="text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase"
              >
                Dependencias que se eliminarán
              </h3>
              <ul
                className="divide-y divide-border border-t border-border"
                aria-label="Dependencias que se eliminarán"
              >
                {visibilityDependencies.map((dependency) => {
                  const source = roadmap.nodes.find((node) => node.id === dependency.sourceNodeId);
                  const target = roadmap.nodes.find((node) => node.id === dependency.targetNodeId);
                  return (
                    <li
                      key={dependency.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 py-3"
                    >
                      <span className="text-sm leading-5 font-medium text-foreground">
                        {source?.title ?? dependency.sourceNodeId}
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="sr-only">conduce a</span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-5 shrink-0 text-destructive"
                          strokeWidth={2.75}
                        />
                      </span>
                      <span className="text-sm leading-5 font-medium text-foreground">
                        {target?.title ?? dependency.targetNodeId}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isVisibilityChanging}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant={pendingVisibilityChange?.isVisible ? 'destructive' : 'default'}
              disabled={isVisibilityChanging}
              onClick={() => void confirmVisibilityChange()}
            >
              {pendingVisibilityChange?.isVisible ? 'Ocultar' : 'Mostrar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingDependencyChange)}
        onOpenChange={(open) =>
          !open && dispatchCanvas({ type: 'update', update: { pendingDependencyChange: null } })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">Confirmar bloqueo</AlertDialogTitle>
            <AlertDialogDescription>
              Esta dependencia bloqueará persistentemente{' '}
              {pendingDependencyChange?.nodes.length ?? 0}{' '}
              {(pendingDependencyChange?.nodes.length ?? 0) === 1 ? 'nodo' : 'nodos'}.
            </AlertDialogDescription>
            <p className="text-sm text-muted-foreground">
              Bloquear u ordenar dependencias puede afectar el acceso y progreso estudiantil.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {pendingDependencyChange?.nodes.map((node) => (
                <li key={node.id}>{node.title}</li>
              ))}
            </ul>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={() => {
                if (pendingDependencyChange)
                  void connectNodes(
                    pendingDependencyChange.sourceNodeId,
                    pendingDependencyChange.targetNodeId,
                    pendingDependencyChange.sourceHandle,
                    pendingDependencyChange.targetHandle,
                  );
                dispatchCanvas({ type: 'update', update: { pendingDependencyChange: null } });
              }}
            >
              Conectar y bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingTeacherBlockChange)}
        onOpenChange={(open) =>
          !open && dispatchCanvas({ type: 'update', update: { pendingTeacherBlockChange: null } })
        }
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              {teacherBlockDialog?.title}
            </AlertDialogTitle>
            <AlertDialogDescription>{teacherBlockDialog?.description}</AlertDialogDescription>
            <p className="text-sm text-muted-foreground">
              Esta acción puede afectar el acceso y progreso estudiantil.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {pendingTeacherBlockChange?.nodes.map((node) => (
                <li key={node.id} className="flex items-center gap-2">
                  {node.nodeType ? (
                    <NodeTypeIcon
                      icon={node.nodeType.icon}
                      className="size-4 shrink-0"
                      style={{ color: node.nodeType.color }}
                      aria-label={node.nodeType.name}
                    />
                  ) : null}
                  <span>{node.title}</span>
                  {node.relation ? (
                    <span className="text-xs">
                      (
                      {
                        {
                          SELECTED_NODE: 'Nodo seleccionado',
                          PREREQUISITE: 'Prerrequisito',
                          DEPENDENT: 'Dependiente',
                        }[node.relation]
                      }
                      )
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
            {pendingTeacherBlockChange?.mode === 'SINGLE' ||
            pendingTeacherBlockChange?.mode === 'BRANCH' ? (
              <fieldset className="flex flex-col gap-2 text-sm text-foreground">
                <legend className="font-medium">Alcance del desbloqueo</legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="unlock-scope"
                    checked={pendingTeacherBlockChange.operation === 'UNBLOCK'}
                    onChange={() =>
                      void requestTeacherBlockChange(pendingTeacherBlockChange.nodeId, 'UNBLOCK')
                    }
                  />
                  Solo este Nodo
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="unlock-scope"
                    checked={pendingTeacherBlockChange.operation === 'BRANCH_UNLOCK'}
                    onChange={() =>
                      void requestTeacherBlockChange(
                        pendingTeacherBlockChange.nodeId,
                        'BRANCH_UNLOCK',
                      )
                    }
                  />
                  Este Nodo y su rama
                </label>
              </fieldset>
            ) : null}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              disabled={isTeacherBlockChanging}
              onClick={() => void confirmTeacherBlockChange()}
            >
              {teacherBlockDialog?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
