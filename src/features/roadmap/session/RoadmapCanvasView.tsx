'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import dynamic from 'next/dynamic';
import { CircleAlert, Eye, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { CanvasPreviewToolbar } from '@/features/roadmap/canvas/CanvasPreviewToolbar';
import { KeyboardShortcuts } from '@/features/roadmap/canvas/KeyboardShortcuts';
import { useCanvasPreviewWorkflow } from '@/features/roadmap/canvas/canvas-preview-workflow';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';
import { canvasStateReducer, initialCanvasState } from '@/features/roadmap/canvas/state';
import { useNodeDeletionWorkflow } from '@/features/roadmap/canvas/node-deletion-workflow';
import { useNodeVisibilityWorkflow } from '@/features/roadmap/canvas/node-visibility-workflow';
import { useTeacherBlockWorkflow } from '@/features/roadmap/canvas/teacher-block-workflow';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import type {
  NodeEditorEffect,
  NodeEditorHandle,
  NodeEditorGuardReason,
  NodeEditorIntent,
  NodeEditorPerformResult,
} from '@/features/roadmap/editor/types';
import { NodeEditorPanel } from '@/features/roadmap/ui/NodeEditorPanel';
import {
  RoadmapGraph,
  type RoadmapGraphEditing,
  type RoadmapGraphEditingIntent,
  type RoadmapGraphProjection,
} from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import { useRoadmapCanvasSession } from '@/features/roadmap/session/session';
import {
  RoadmapCanvasFeedback,
  useRoadmapCanvasFeedback,
} from '@/features/roadmap/session/feedback';
import type {
  CourseOfferingIdentifier,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';
import {
  nodeTypeDeletionConfirmation,
  roadmapAutoLayoutConfirmation,
  roadmapConfirmationActionIds,
} from '@/features/roadmap/ui/roadmap-confirmation';

type ExclusiveConfirmationSource =
  | 'automatic-layout'
  | 'canvas-preview'
  | 'dependency-creation'
  | 'dependency-deletion'
  | 'node-deletion'
  | 'node-type-deletion'
  | 'node-visibility'
  | 'teacher-block';

type AutomaticLayoutRequest = {
  positions: Extract<RoadmapGraphEditingIntent, { kind: 'request-automatic-layout' }>['positions'];
  direction: Extract<RoadmapGraphEditingIntent, { kind: 'request-automatic-layout' }>['direction'];
  isPending: boolean;
};

/** Private vocabulary: Graph and NodeEditor events are translated before reaching the session. */
type RoadmapCanvasIntent =
  | { kind: 'close-selected-node' }
  | ({ kind: 'preview-node-information' } & Extract<
      NodeEditorIntent,
      { kind: 'preview-node-information' }
    >)
  | { kind: 'change-visibility'; nodeId: string; isVisible: boolean }
  | { kind: 'change-teacher-block'; nodeId: string; operation: TeacherBlockOperation }
  | { kind: 'delete-node'; nodeId: string; draftWasDiscarded?: boolean }
  | Extract<RoadmapGraphEditingIntent, { kind: 'node-positions' | 'request-automatic-layout' }>
  | {
      kind: 'request-dependency-creation';
      request: Extract<RoadmapGraphEditingIntent, { kind: 'create-dependency' }>;
    }
  | { kind: 'request-dependency-deletion'; dependencyIds: string[] }
  | { kind: 'add-resource'; nodeId: string };

function canvasIntentFromNodeEditor(intent: NodeEditorIntent): RoadmapCanvasIntent {
  switch (intent.kind) {
    case 'close':
      return { kind: 'close-selected-node' };
    case 'preview-node-information':
      return intent;
    case 'change-visibility':
    case 'change-teacher-block':
      return intent;
    case 'delete-node':
      return { ...intent, draftWasDiscarded: true };
  }
}

function canvasIntentFromGraph(intent: RoadmapGraphEditingIntent): RoadmapCanvasIntent {
  if (intent.kind === 'change-visibility') return { ...intent, isVisible: !intent.isVisible };
  if (intent.kind === 'create-dependency')
    return { kind: 'request-dependency-creation', request: intent };
  if (intent.kind === 'delete-dependencies')
    return { kind: 'request-dependency-deletion', dependencyIds: [...intent.dependencyIds] };
  return intent;
}

const NodeEditor = dynamic(
  () => import('@/features/roadmap/editor/NodeEditor').then(({ NodeEditor }) => NodeEditor),
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

export function RoadmapCanvasView({
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
  const [focusReturnRequest, setFocusReturnRequest] = useState<string | null>(null);
  const {
    selectedNodeId,
    isEditorOpen,
    isStudentDetailOpen,
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    resourceComposerCommand,
    teacherPreviewFocusReturn,
  } = canvasState;
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const nodeEditorRef = useRef<NodeEditorHandle>(null);
  const focusReturnRequestIdRef = useRef(0);
  const {
    roadmap,
    error,
    dismissError,
    addNode,
    updateNode,
    moveNode,
    previewTeacherBlock,
    changeTeacherBlock,
    dependencyWorkflow,
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
  } = useRoadmapCanvasSession({
    courseOffering: { identifier, title },
    experience: {
      kind: canEdit || canPreview ? 'teaching' : 'student',
      term: isHistorical ? 'historical' : 'current',
    },
  });
  const feedback = useRoadmapCanvasFeedback();
  const teacherBlockWorkflow = useTeacherBlockWorkflow({
    roadmap,
    previewTeacherBlock,
    changeTeacherBlock,
  });
  const nodeVisibilityWorkflow = useNodeVisibilityWorkflow({
    roadmap,
    previewNodeVisibility,
    toggleVisibility,
  });
  const [exclusiveConfirmation, setExclusiveConfirmation] =
    useState<ExclusiveConfirmationSource | null>(null);
  const exclusiveConfirmationRef = useRef<ExclusiveConfirmationSource | null>(null);
  const exclusiveBusySeenRef = useRef(false);
  const [automaticLayout, setAutomaticLayout] = useState<AutomaticLayoutRequest | null>(null);
  const [confirmedAutomaticLayout, setConfirmedAutomaticLayout] = useState<{
    token: string;
    direction: AutomaticLayoutRequest['direction'];
  } | null>(null);
  const automaticLayoutTokenRef = useRef(0);
  const [nodeTypeDeletion, setNodeTypeDeletion] = useState<{
    nodeType: RoadmapDto['nodeTypes'][number];
    isPending: boolean;
  } | null>(null);
  const requestExclusiveConfirmation = useCallback(
    (source: ExclusiveConfirmationSource, request: () => void) => {
      if (exclusiveConfirmationRef.current) return false;
      exclusiveConfirmationRef.current = source;
      exclusiveBusySeenRef.current = false;
      setExclusiveConfirmation(source);
      request();
      return true;
    },
    [],
  );
  useEffect(() => {
    exclusiveConfirmationRef.current = exclusiveConfirmation;
  }, [exclusiveConfirmation]);
  useEffect(() => {
    feedback?.reportError(roadmap ? error : null, dismissError);
  }, [dismissError, error, feedback, roadmap]);

  const requestNodeFocusReturn = useCallback(() => {
    setFocusReturnRequest(`node-surface-close-${++focusReturnRequestIdRef.current}`);
  }, []);

  const updateNodeWithConfirmation = useCallback(
    async (...args: Parameters<typeof updateNode>) => {
      const succeeded = await updateNode(...args);
      if (succeeded) feedback?.showSuccess('Cambios guardados exitosamente.');
      return succeeded;
    },
    [feedback, updateNode],
  );

  const addResourceWithConfirmation = useCallback(
    async (...args: Parameters<typeof addResource>) => {
      const succeeded = await addResource(...args);
      if (succeeded) feedback?.showSuccess('Enlace guardado exitosamente.');
      return succeeded;
    },
    [addResource, feedback],
  );

  const updateResourceWithConfirmation = useCallback(
    async (...args: Parameters<typeof updateResource>) => {
      const succeeded = await updateResource(...args);
      if (succeeded) {
        feedback?.showSuccess(
          args[1].type === 'LINK'
            ? 'Enlace guardado exitosamente.'
            : 'Recurso guardado exitosamente.',
        );
      }
      return succeeded;
    },
    [feedback, updateResource],
  );

  const performEditorEffect = useCallback(
    async (effect: NodeEditorEffect): Promise<NodeEditorPerformResult> => {
      let succeeded = false;
      switch (effect.kind) {
        case 'update-node':
          succeeded = await updateNodeWithConfirmation(effect.nodeId, effect.value);
          break;
        case 'add-resource':
          succeeded = await addResourceWithConfirmation(effect.nodeId, effect.resource);
          break;
        case 'upload-resource':
          succeeded = await uploadResource(effect.nodeId, effect.file);
          if (succeeded) feedback?.showSuccess('Recurso guardado exitosamente.');
          break;
        case 'update-resource':
          succeeded = await updateResourceWithConfirmation(effect.resourceId, effect.resource);
          break;
        case 'delete-resource':
          succeeded = await deleteResource(effect.resourceId);
          if (succeeded) feedback?.showSuccess('Recurso eliminado exitosamente.');
          break;
      }
      return { status: succeeded ? 'committed' : 'rejected' };
    },
    [
      addResourceWithConfirmation,
      deleteResource,
      updateNodeWithConfirmation,
      updateResourceWithConfirmation,
      uploadResource,
      feedback,
    ],
  );

  const guardEditorDraft = useCallback(
    (reason: NodeEditorGuardReason) =>
      nodeEditorRef.current?.guardDraft(reason) ?? Promise.resolve(true),
    [],
  );

  const closeEditorAfterNodeDeletion = useCallback(() => {
    dispatchCanvas({ type: 'closeSelectedNode', panel: 'editor' });
    requestNodeFocusReturn();
  }, [requestNodeFocusReturn]);

  const nodeDeletionWorkflow = useNodeDeletionWorkflow({
    previewNodeDeletion,
    deleteNode,
    guardDraft: guardEditorDraft,
    closeEditor: closeEditorAfterNodeDeletion,
  });

  const prepareCanvasPreview = useCallback(() => {
    dispatchCanvas({ type: 'prepareCanvasPreview' });
  }, []);

  const restoreCanvasPreview = useCallback(
    ({
      selectedNodeId: previousSelectedNodeId,
      isEditorOpen: wasEditorOpen,
      isStudentDetailOpen: wasStudentDetailOpen,
    }: {
      selectedNodeId: string | null;
      isEditorOpen: boolean;
      isStudentDetailOpen: boolean;
    }) => {
      dispatchCanvas({
        type: 'restoreCanvasPreview',
        selectedNodeId: previousSelectedNodeId,
        isEditorOpen: wasEditorOpen,
        isStudentDetailOpen: wasStudentDetailOpen,
      });
    },
    [],
  );

  const canvasPreviewWorkflow = useCanvasPreviewWorkflow({
    currentView: { selectedNodeId, isEditorOpen, isStudentDetailOpen },
    isHistorical: Boolean(isHistorical),
    guardDraft: () => guardEditorDraft({ kind: 'enter-canvas-preview' }),
    loadSimulation,
    completeSimulatedNode,
    resetSimulation,
    onEnter: prepareCanvasPreview,
    onExit: restoreCanvasPreview,
  });

  useEffect(() => {
    if (!exclusiveConfirmation) return;
    const sourceIsBusy = {
      'automatic-layout': automaticLayout !== null,
      'canvas-preview': canvasPreviewWorkflow.isResetPending,
      'dependency-creation': dependencyWorkflow.isBusy,
      'dependency-deletion': dependencyWorkflow.isBusy,
      'node-deletion': nodeDeletionWorkflow.isBusy,
      'node-type-deletion': nodeTypeDeletion !== null,
      'node-visibility': nodeVisibilityWorkflow.isBusy,
      'teacher-block': teacherBlockWorkflow.isBusy,
    }[exclusiveConfirmation];
    if (sourceIsBusy) {
      exclusiveBusySeenRef.current = true;
      return;
    }
    if (exclusiveBusySeenRef.current) setExclusiveConfirmation(null);
  }, [
    automaticLayout,
    canvasPreviewWorkflow.isResetPending,
    dependencyWorkflow.isBusy,
    exclusiveConfirmation,
    nodeDeletionWorkflow.isBusy,
    nodeTypeDeletion,
    nodeVisibilityWorkflow.isBusy,
    teacherBlockWorkflow.isBusy,
  ]);

  const canvasMode = deriveCanvasMode({
    canEdit,
    canPreview,
    isHistorical,
    isCanvasPreview: canvasPreviewWorkflow.isActive,
  });
  const { isHistorical: isHistoricalRoadmap, isCanvasPreview, isStudentExperience } = canvasMode;
  const { canEditRoadmap, canPreviewCanvas, canEnterCanvasPreview, canResetCanvasPreview } =
    canvasMode.capabilities;

  const closeSelectedNodeNow = useCallback(() => {
    dispatchCanvas({
      type: 'closeSelectedNode',
      panel: canEditRoadmap ? 'editor' : 'student',
    });
    requestNodeFocusReturn();
  }, [canEditRoadmap, requestNodeFocusReturn]);

  const closeSelectedNode = useCallback(() => {
    if (canEditRoadmap && selectedNodeId && !isCanvasPreview) {
      void guardEditorDraft({ kind: 'deselect-node', nodeId: selectedNodeId }).then((proceed) => {
        if (proceed) closeSelectedNodeNow();
      });
      return;
    }
    closeSelectedNodeNow();
  }, [canEditRoadmap, closeSelectedNodeNow, guardEditorDraft, isCanvasPreview, selectedNodeId]);

  const closeTeacherPreview = useCallback(() => {
    const focusReturn = teacherPreviewFocusReturn;
    dispatchCanvas({ type: 'closeTeacherPreview' });
    requestAnimationFrame(() => focusReturn?.());
  }, [teacherPreviewFocusReturn]);

  const openResourceComposer = useCallback(
    (nodeId: string) => {
      if (!canEditRoadmap || isCanvasPreview) return;
      void guardEditorDraft({ kind: 'open-resource', nodeId }).then((proceed) => {
        if (!proceed) return;
        dispatchCanvas({
          type: 'openResourceComposer',
          command: {
            id: crypto.randomUUID(),
            kind: 'open-resource',
            nodeId,
            mode: 'file',
          },
        });
      });
    },
    [canEditRoadmap, guardEditorDraft, isCanvasPreview],
  );

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
  }, [
    canEditRoadmap,
    closeTeacherPreview,
    isCanvasPreview,
    isEditorOpen,
    selectedNodeId,
    teacherPreviewNode,
  ]);

  const displayedRoadmap = isCanvasPreview ? simulationRoadmap : roadmap;
  const requestDependencyCreation = useCallback(
    (...args: Parameters<typeof dependencyWorkflow.requestCreation>) =>
      requestExclusiveConfirmation('dependency-creation', () =>
        dependencyWorkflow.requestCreation(...args),
      ),
    [dependencyWorkflow, requestExclusiveConfirmation],
  );
  const requestDependencyDeletion = useCallback(
    (...args: Parameters<typeof dependencyWorkflow.requestDeletion>) =>
      requestExclusiveConfirmation('dependency-deletion', () =>
        dependencyWorkflow.requestDeletion(...args),
      ),
    [dependencyWorkflow, requestExclusiveConfirmation],
  );
  const requestNodeDeletion = useCallback(
    (nodeId: string, options: { draftWasDiscarded?: boolean } = {}) => {
      const begin = () =>
        requestExclusiveConfirmation('node-deletion', () =>
          nodeDeletionWorkflow.requestDeletion(nodeId, { draftWasDiscarded: true }),
        );
      if (options.draftWasDiscarded) return begin();
      void guardEditorDraft({ kind: 'delete-node', nodeId }).then((proceed) => {
        if (proceed) begin();
      });
      return false;
    },
    [guardEditorDraft, nodeDeletionWorkflow, requestExclusiveConfirmation],
  );
  const requestTeacherBlockChange = useCallback(
    (...args: Parameters<typeof teacherBlockWorkflow.requestChange>) =>
      requestExclusiveConfirmation('teacher-block', () =>
        teacherBlockWorkflow.requestChange(...args),
      ),
    [requestExclusiveConfirmation, teacherBlockWorkflow],
  );
  const requestVisibilityChange = useCallback(
    (...args: Parameters<typeof nodeVisibilityWorkflow.requestChange>) =>
      requestExclusiveConfirmation(
        'node-visibility',
        () => void nodeVisibilityWorkflow.requestChange(...args),
      ),
    [nodeVisibilityWorkflow, requestExclusiveConfirmation],
  );
  const requestAutomaticLayout = useCallback(
    (
      positions: AutomaticLayoutRequest['positions'],
      direction: AutomaticLayoutRequest['direction'],
    ) => {
      if (positions.length === 0) return;
      requestExclusiveConfirmation('automatic-layout', () =>
        setAutomaticLayout({ positions, direction, isPending: false }),
      );
    },
    [requestExclusiveConfirmation],
  );
  const confirmAutomaticLayout = useCallback(
    async (actionId: string) => {
      if (
        actionId !== roadmapConfirmationActionIds.autoLayout ||
        !automaticLayout?.positions.length
      )
        return;
      setAutomaticLayout((current) => (current ? { ...current, isPending: true } : null));
      await Promise.all(
        automaticLayout.positions.map(({ nodeId, position }) => moveNode(nodeId, position)),
      );
      setConfirmedAutomaticLayout({
        token: `automatic-layout-${++automaticLayoutTokenRef.current}`,
        direction: automaticLayout.direction,
      });
      setAutomaticLayout(null);
    },
    [automaticLayout, moveNode],
  );
  const requestNodeTypeDeletion = useCallback(
    (nodeType: RoadmapDto['nodeTypes'][number]) => {
      requestExclusiveConfirmation('node-type-deletion', () =>
        setNodeTypeDeletion({ nodeType, isPending: false }),
      );
    },
    [requestExclusiveConfirmation],
  );
  const confirmNodeTypeDeletion = useCallback(
    async (actionId: string) => {
      if (actionId !== roadmapConfirmationActionIds.deleteNodeType || !nodeTypeDeletion) return;
      setNodeTypeDeletion((current) => (current ? { ...current, isPending: true } : null));
      const deleted = await deleteNodeType(nodeTypeDeletion.nodeType.id);
      if (deleted) setNodeTypeDeletion(null);
      else setNodeTypeDeletion((current) => (current ? { ...current, isPending: false } : null));
    },
    [deleteNodeType, nodeTypeDeletion],
  );
  const handleCanvasIntent = useCallback(
    (intent: RoadmapCanvasIntent) => {
      switch (intent.kind) {
        case 'close-selected-node':
          closeSelectedNodeNow();
          return;
        case 'preview-node-information':
          dispatchCanvas({
            type: 'showTeacherPreview',
            node: intent.node,
            focusReturn: intent.returnFocus,
          });
          return;
        case 'change-visibility':
          void requestVisibilityChange(intent.nodeId, intent.isVisible);
          return;
        case 'change-teacher-block':
          requestTeacherBlockChange(intent.nodeId, intent.operation);
          return;
        case 'delete-node':
          requestNodeDeletion(intent.nodeId, { draftWasDiscarded: intent.draftWasDiscarded });
          return;
        case 'node-positions':
          void Promise.all(
            intent.positions.map(({ nodeId, position }) => moveNode(nodeId, position)),
          );
          return;
        case 'request-automatic-layout':
          requestAutomaticLayout(intent.positions, intent.direction);
          return;
        case 'request-dependency-creation':
          requestDependencyCreation(intent.request);
          return;
        case 'request-dependency-deletion':
          requestDependencyDeletion(intent.dependencyIds);
          return;
        case 'add-resource':
          openResourceComposer(intent.nodeId);
          return;
      }
    },
    [
      closeSelectedNodeNow,
      moveNode,
      openResourceComposer,
      requestDependencyCreation,
      requestDependencyDeletion,
      requestNodeDeletion,
      requestTeacherBlockChange,
      requestAutomaticLayout,
      requestVisibilityChange,
    ],
  );
  const handleNodeEditorIntent = useCallback(
    (intent: NodeEditorIntent) => handleCanvasIntent(canvasIntentFromNodeEditor(intent)),
    [handleCanvasIntent],
  );
  const handleGraphEditingIntent = useCallback(
    (intent: RoadmapGraphEditingIntent) => handleCanvasIntent(canvasIntentFromGraph(intent)),
    [handleCanvasIntent],
  );
  const graphEditing = useMemo<RoadmapGraphEditing | undefined>(
    () =>
      canvasMode.isEditing
        ? {
            onEditingIntent: handleGraphEditingIntent,
          }
        : undefined,
    [canvasMode.isEditing, handleGraphEditingIntent],
  );
  const graphProjection = useMemo<RoadmapGraphProjection | null>(() => {
    if (!displayedRoadmap) return null;
    return isStudentExperience
      ? { kind: 'student', roadmap: displayedRoadmap as StudentRoadmapDto }
      : { kind: 'teaching', roadmap: displayedRoadmap as RoadmapDto, editing: graphEditing };
  }, [displayedRoadmap, graphEditing, isStudentExperience]);

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
  if (!displayedRoadmap || !graphProjection) {
    return (
      <Empty className="m-4 min-h-56 w-auto border bg-card">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Spinner aria-label="Cargando simulación" className="motion-reduce:animate-none" />
          </EmptyMedia>
          <EmptyTitle>Cargando simulación...</EmptyTitle>
        </EmptyHeader>
      </Empty>
    );
  }
  const selectedNode = displayedRoadmap.nodes.find((node) => node.id === selectedNodeId);
  const addNodeAtOpenPosition = (
    node: Parameters<typeof addNode>[0],
    findOpenPosition: (title: string) => { x: number; y: number } | null,
  ) => {
    const position = findOpenPosition(node.title);
    if (!position) return Promise.resolve(false);
    return addNode(node, position, (nodeId) =>
      dispatchCanvas({ type: 'selectCreatedNode', nodeId }),
    );
  };
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
          <RoadmapGraph
            projection={graphProjection}
            onSelectNode={(nodeId) => {
              const node = displayedRoadmap.nodes.find((candidate) => candidate.id === nodeId);
              if (isStudentExperience && isStudentBlockedNode(node)) return;
              const select = () =>
                dispatchCanvas({
                  type: 'selectNode',
                  nodeId,
                  panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
                });
              if (
                canEditRoadmap &&
                !isCanvasPreview &&
                selectedNodeId &&
                selectedNodeId !== nodeId
              ) {
                void guardEditorDraft({ kind: 'replace-node', nodeId }).then((proceed) => {
                  if (proceed) select();
                });
                return;
              }
              select();
            }}
            selectedNodeId={selectedNodeId}
            focusReturnRequest={focusReturnRequest}
            onClearSelectedNode={closeSelectedNode}
            onViewportChange={canvasPreviewWorkflow.onViewportChange}
            viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
            confirmedAutomaticLayout={confirmedAutomaticLayout}
            topRightActions={
              !isCanvasPreview && (canEditRoadmap || canPreviewCanvas)
                ? (findOpenPosition) => (
                    <>
                      {canEditRoadmap ? (
                        <NodeCreator
                          nodeTypes={roadmap.nodeTypes}
                          onSubmit={(node) => addNodeAtOpenPosition(node, findOpenPosition)}
                          onCreateNodeType={addNodeType}
                          onUpdateNodeType={updateNodeType}
                          onRequestDeleteNodeType={requestNodeTypeDeletion}
                        />
                      ) : null}
                      {canEnterCanvasPreview ? (
                        <Button
                          ref={canvasPreviewWorkflow.entryButtonRef}
                          aria-label="Previsualizar canvas"
                          title="Previsualizar canvas"
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={canvasPreviewWorkflow.requestEntry}
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
            overlaySlots={{
              topLeft: (
                <header>
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
              ),
              topCenter: isCanvasPreview ? (
                <CanvasPreviewToolbar
                  canReset={canResetCanvasPreview}
                  isHistorical={isHistoricalRoadmap}
                  onRequestReset={() =>
                    requestExclusiveConfirmation(
                      'canvas-preview',
                      canvasPreviewWorkflow.requestReset,
                    )
                  }
                  onExit={canvasPreviewWorkflow.exit}
                />
              ) : null,
              bottomRight: (
                <>
                  <KeyboardShortcuts
                    key="roadmap-keyboard-shortcuts"
                    isEditing={canvasMode.isEditing}
                  />
                </>
              ),
            }}
          />
          <RoadmapCanvasFeedback />
        </div>
        {canEditRoadmap && (
          <NodeEditorPanel
            isOpen={canvasMode.isEditing && isEditorOpen}
            panelWidth={editorPanel.width}
            onPanelWidthChange={editorPanel.setWidth}
          >
            <NodeEditor
              ref={nodeEditorRef}
              session={{
                node: selectedNode as RoadmapNode | undefined,
                nodeTypes: roadmap.nodeTypes,
                isVisibilityPending: nodeVisibilityWorkflow.isPending,
              }}
              command={resourceComposerCommand ?? undefined}
              perform={performEditorEffect}
              onIntent={handleNodeEditorIntent}
            />
          </NodeEditorPanel>
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
              if (canvasPreviewWorkflow.completeNode(node.id)) return;
              if (teacherPreviewNode) dispatchCanvas({ type: 'completeTeacherPreview' });
              else {
                void completeNode(node.id).then((succeeded) => {
                  if (succeeded) feedback?.showSuccess('Nodo completado.');
                });
              }
            }}
            isReadOnly={isHistoricalRoadmap && !teacherPreviewNode}
            nodeTypes={roadmap.nodeTypes}
            panelWidth={teacherPreviewNode ? editorPanel.width : studentPanel.width}
            onPanelWidthChange={teacherPreviewNode ? editorPanel.setWidth : studentPanel.setWidth}
          />
        )}
      </section>
      <ConfirmationDialog
        {...(exclusiveConfirmation === 'automatic-layout'
          ? {
              confirmation: automaticLayout ? roadmapAutoLayoutConfirmation : null,
              pendingActionId: automaticLayout?.isPending
                ? roadmapConfirmationActionIds.autoLayout
                : undefined,
              onCancel: () => setAutomaticLayout(null),
              onAction: (actionId: string) => void confirmAutomaticLayout(actionId),
            }
          : exclusiveConfirmation === 'node-type-deletion'
            ? {
                confirmation: nodeTypeDeletion
                  ? nodeTypeDeletionConfirmation(nodeTypeDeletion.nodeType)
                  : null,
                pendingActionId: nodeTypeDeletion?.isPending
                  ? roadmapConfirmationActionIds.deleteNodeType
                  : undefined,
                onCancel: () => {
                  if (!nodeTypeDeletion?.isPending) setNodeTypeDeletion(null);
                },
                onAction: (actionId: string) => void confirmNodeTypeDeletion(actionId),
              }
            : exclusiveConfirmation === 'node-deletion'
              ? nodeDeletionWorkflow.confirmationDialog
              : exclusiveConfirmation === 'canvas-preview'
                ? canvasPreviewWorkflow.confirmationDialog
                : exclusiveConfirmation === 'dependency-deletion'
                  ? dependencyWorkflow.deletionDialog
                  : exclusiveConfirmation === 'node-visibility'
                    ? nodeVisibilityWorkflow.confirmationDialog
                    : exclusiveConfirmation === 'dependency-creation'
                      ? dependencyWorkflow.creationDialog
                      : exclusiveConfirmation === 'teacher-block'
                        ? teacherBlockWorkflow.confirmationDialog
                        : {
                            confirmation: null,
                            onCancel: () => undefined,
                            onAction: () => undefined,
                          })}
      />
    </SidebarProvider>
  );
}
