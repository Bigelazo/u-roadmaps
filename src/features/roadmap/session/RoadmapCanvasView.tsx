'use client';

import { Tooltip, TooltipTrigger, TooltipContent } from '@/shared/ui/tooltip';

import { NodeChangeCountsProvider } from '@/features/notifications/client';

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
import Link from 'next/link';
import { CircleAlert, CircleHelp, Eye, History, LogOut, Users } from 'lucide-react';
import { courseParticipantsUrl, versionHistoryUrl } from '@/features/roadmap/client';
import { CanvasPreviewToolbar } from '@/features/roadmap/canvas/CanvasPreviewToolbar';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';
import { canvasStateReducer, initialCanvasState } from '@/features/roadmap/canvas/state';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import type {
  NodeEditorEffect,
  NodeEditorHandle,
  NodeEditorGuardReason,
  NodeEditorIntent,
  NodeEditorPerformResult,
  NodeInput,
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
import type {
  CanvasCommand,
  CanvasConfirmationChoice,
} from '@/features/roadmap/canvas/commands/commands';
import type { RoadmapLayoutDirection } from '@/features/roadmap/graph/dagre-layout';
import type {
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { notify } from '@/shared/ui/notify';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';
import {
  TUTORIAL_EXIT_ATTRIBUTE,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  markTutorialClosingPopover,
} from '@/shared/client/tutorial/tutorial-support';
import { TutorialClosingPopover } from '@/shared/client/tutorial/tutorial';
import { useNotificationAcknowledgement } from '@/features/notifications/client';
import { termLabel } from '@/shared/course-offering';
import { canvasConfirmation } from '@/features/roadmap/ui/roadmap-confirmation';

const NodeEditor = dynamic(
  () => import('@/features/roadmap/editor/NodeEditor').then(({ NodeEditor }) => NodeEditor),
  { ssr: false },
);

type Props = { input: RoadmapCanvasSessionInput };

function RoadmapCanvasLoading({ isSimulation = false }: { isSimulation?: boolean }) {
  const title = isSimulation ? 'Cargando simulación...' : 'Cargando roadmap...';

  return (
    <section
      data-page-width="full"
      aria-busy="true"
      className="roadmap-canvas-loading flex min-h-0 w-full flex-1 bg-background lg:h-full"
    >
      <Empty role="status" aria-label={title} className="rounded-none">
        <EmptyHeader>
          <EmptyMedia>
            <Spinner role="img" aria-hidden="true" className="size-8 motion-reduce:animate-none" />
          </EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>
            {isSimulation
              ? 'Preparando la vista de estudiante.'
              : 'Preparando los nodos y sus conexiones.'}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    </section>
  );
}

/**
 * Shows `message` as a toast with a stable id while it is set and closes it once it clears.
 * Closing the toast (timeout, button, swipe or unmount) calls `onClose` so the source state clears.
 */
function useStateToast(
  tone: 'error' | 'neutral',
  id: string,
  message: string | null,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (message) notify[tone](message, { id, onClose: () => onCloseRef.current() });
    else notify.close(id);
  }, [id, message, tone]);
  useEffect(() => () => notify.close(id), [id]);
}

function useRoadmapCanvasController({ input }: Props) {
  const { identifier, title } = input.courseOffering;
  const { courseCode, year, semester } = identifier;
  const [canvasState, dispatchCanvas] = useReducer(canvasStateReducer, initialCanvasState);
  const [focusReturnRequest, setFocusReturnRequest] = useState<string | null>(null);
  const [syncedSelectionNotice, setSyncedSelectionNotice] = useState<string | null>(null);
  const [dismissedInvalidTargetId, setDismissedInvalidTargetId] = useState<string | null>(null);
  const acknowledgedRoadmapRef = useRef<string | null>(null);
  const { acknowledge } = useNotificationAcknowledgement();
  const canvasFocusRef = useRef<HTMLDivElement>(null);
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
  const requestNodeFocusReturn = useCallback(() => {
    setFocusReturnRequest(`node-surface-close-${++focusReturnRequestIdRef.current}`);
  }, []);
  const guardEditorDraft = useCallback(
    (reason: NodeEditorGuardReason) =>
      nodeEditorRef.current?.guardDraft(reason) ?? Promise.resolve(true),
    [],
  );
  const [confirmedAutomaticLayout, setConfirmedAutomaticLayout] = useState<{
    token: string;
    direction: RoadmapLayoutDirection;
  } | null>(null);
  const automaticLayoutTokenRef = useRef(0);
  const followAppliedCommand = useCallback(
    (command: CanvasCommand, createdNodeId?: string) => {
      if (command.kind === 'add-node' && createdNodeId) {
        dispatchCanvas({ type: 'selectCreatedNode', nodeId: createdNodeId });
      } else if (command.kind === 'delete-node') {
        dispatchCanvas({ type: 'closeSelectedNode', panel: 'editor' });
        requestNodeFocusReturn();
      } else if (command.kind === 'apply-automatic-layout') {
        setConfirmedAutomaticLayout({
          token: `automatic-layout-${++automaticLayoutTokenRef.current}`,
          direction: command.direction,
        });
      }
    },
    [requestNodeFocusReturn],
  );
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
  const {
    roadmap,
    error,
    dismissError,
    retryRefresh,
    accessLost,
    canvasCommands,
    simulationRoadmap,
    canvasPreviewWorkflow,
    isClosed,
  } = useRoadmapCanvasSession(input, {
    guardDraft: guardEditorDraft,
    onCommandApplied: followAppliedCommand,
    canvasPreview: {
      currentView: { selectedNodeId, isEditorOpen, isStudentDetailOpen },
      onEnter: prepareCanvasPreview,
      onExit: restoreCanvasPreview,
    },
  });
  useStateToast('error', 'roadmap-session-error', roadmap ? error : null, dismissError);

  const { request } = canvasCommands;
  const performEditorEffect = useCallback(
    async (effect: NodeEditorEffect): Promise<NodeEditorPerformResult> => ({
      status: (await request(effect)) ? 'committed' : 'rejected',
    }),
    [request],
  );

  const canvasMode = deriveCanvasMode({
    experience: { ...input.experience, term: isClosed ? 'historical' : 'current' },
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
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || !canEditRoadmap) return;
      if (teacherPreviewNode) {
        event.preventDefault();
        closeTeacherPreview();
      } else if (isEditorOpen && !isCanvasPreview) {
        event.preventDefault();
        dispatchCanvas({ type: 'closeEditor' });
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [canEditRoadmap, closeTeacherPreview, isCanvasPreview, isEditorOpen, teacherPreviewNode]);

  const displayedRoadmap = isCanvasPreview ? simulationRoadmap : roadmap;
  const accessibleNodeIds = useMemo(() => {
    if (!roadmap) return new Set<string>();
    return new Set(
      roadmap.nodes.flatMap((node) => {
        if ('isVisible' in node && !node.isVisible) return [];
        if ('access' in node && node.access?.status === 'BLOCKED') return [];
        if ('isTeacherBlocked' in node && node.isTeacherBlocked) return [];
        return [node.id];
      }),
    );
  }, [roadmap]);
  const invalidTargetId =
    roadmap && input.targetNodeId && !accessibleNodeIds.has(input.targetNodeId)
      ? input.targetNodeId
      : null;
  const selectionNotice =
    invalidTargetId && invalidTargetId !== dismissedInvalidTargetId
      ? 'Este Nodo ya no está disponible. Puedes revisar el Roadmap actualizado.'
      : syncedSelectionNotice;
  const dismissSelectionNotice = useCallback(() => {
    setDismissedInvalidTargetId(invalidTargetId);
    setSyncedSelectionNotice(null);
  }, [invalidTargetId]);
  useStateToast('neutral', 'roadmap-selection-notice', selectionNotice, dismissSelectionNotice);
  const acknowledgesRoadmap = fetchesRoadmapNotices(input);
  useEffect(() => {
    if (!acknowledgesRoadmap || !roadmap || isCanvasPreview) return;
    const roadmapId = roadmap.roadmap.id;
    if (acknowledgedRoadmapRef.current === roadmapId) return;
    acknowledgedRoadmapRef.current = roadmapId;
    const operation = { roadmapId, entryKey: input.roadmapEntryKey };
    void acknowledge(operation);
  }, [
    acknowledge,
    accessibleNodeIds,
    acknowledgesRoadmap,
    input.roadmapEntryKey,
    isCanvasPreview,
    roadmap,
  ]);
  const deepLinkHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const nodeId = input.targetNodeId;
    if (!nodeId || !roadmap || deepLinkHandledRef.current === nodeId) return;
    deepLinkHandledRef.current = nodeId;
    if (!accessibleNodeIds.has(nodeId)) return;
    dispatchCanvas({
      type: 'selectNode',
      nodeId,
      panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
    });
  }, [accessibleNodeIds, canEditRoadmap, input.targetNodeId, isStudentExperience, roadmap]);
  useEffect(() => {
    if (!selectedNodeId || !displayedRoadmap) return;
    const selected = displayedRoadmap.nodes.find((node) => node.id === selectedNodeId);
    const blocked = isStudentExperience && isStudentBlockedNode(selected);
    if (selected && !blocked) return;
    if (blocked && !isStudentDetailOpen) return;
    dispatchCanvas({
      type: 'reconcileSelection',
      removed: !selected,
      preserveEditorDraft: canEditRoadmap && Boolean(nodeEditorRef.current?.hasDraft?.()),
    });
    setSyncedSelectionNotice(
      selected
        ? 'El Nodo seleccionado ahora está bloqueado. Se cerró su detalle.'
        : 'El Nodo seleccionado ya no está disponible. Se cerró su detalle.',
    );
    if (selected) requestNodeFocusReturn();
    else requestAnimationFrame(() => canvasFocusRef.current?.focus());
  }, [
    canEditRoadmap,
    displayedRoadmap,
    isStudentDetailOpen,
    isStudentExperience,
    requestNodeFocusReturn,
    selectedNodeId,
  ]);
  const handleNodeEditorIntent = useCallback(
    (intent: NodeEditorIntent) => {
      switch (intent.kind) {
        case 'close':
          closeSelectedNodeNow();
          return;
        case 'preview-node-information':
          dispatchCanvas({
            type: 'showTeacherPreview',
            node: intent.node,
            focusReturn: intent.returnFocus,
          });
          return;
        default:
          void request(intent);
      }
    },
    [closeSelectedNodeNow, request],
  );
  const handleGraphEditingIntent = useCallback(
    (intent: RoadmapGraphEditingIntent) => {
      if (intent.kind === 'add-resource') openResourceComposer(intent.nodeId);
      else void request(intent);
    },
    [openResourceComposer, request],
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

  return {
    title,
    courseCode,
    year,
    semester,
    dispatchCanvas,
    focusReturnRequest,
    dismissSelectionNotice,
    canvasFocusRef,
    selectedNodeId,
    isEditorOpen,
    isStudentDetailOpen,
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    resourceComposerCommand,
    editorPanel,
    studentPanel,
    nodeEditorRef,
    guardEditorDraft,
    roadmap,
    error,
    retryRefresh,
    accessLost,
    canvasCommands,
    canvasPreviewWorkflow,
    confirmedAutomaticLayout,
    performEditorEffect,
    canvasMode,
    isHistoricalRoadmap,
    isCanvasPreview,
    isStudentExperience,
    canEditRoadmap,
    canPreviewCanvas,
    canEnterCanvasPreview,
    canResetCanvasPreview,
    closeSelectedNode,
    closeTeacherPreview,
    displayedRoadmap,
    handleNodeEditorIntent,
    graphProjection,
  };
}

/**
 * Real Roadmap notices are fetched and acknowledged only outside the Practice roadmap,
 * which belongs to no Course offering and only shows its fixed change marks.
 */
function fetchesRoadmapNotices(input: RoadmapCanvasSessionInput) {
  return Boolean(input.notificationsEnabled) && !input.practice;
}

/** Node change marks show the server's counts, or the Practice roadmap's fixed ones. */
function showsNodeChangeMarks(input: RoadmapCanvasSessionInput) {
  return fetchesRoadmapNotices(input) || Boolean(input.practice);
}

export function RoadmapCanvasView({ input }: Props) {
  const model = useRoadmapCanvasController({ input });
  const {
    canvasFocusRef,
    selectedNodeId,
    roadmap,
    error,
    retryRefresh,
    accessLost,
    canvasCommands,
    displayedRoadmap,
    graphProjection,
  } = model;

  if (accessLost) {
    return <LostRoadmapAccess />;
  }
  if (error && !roadmap) {
    return (
      <Alert variant="destructive" className="m-4 max-w-2xl">
        <CircleAlert aria-hidden="true" />
        <AlertTitle>Error al cargar el roadmap</AlertTitle>
        <AlertDescription>
          {error}
          <Button type="button" onClick={retryRefresh}>
            Reintentar actualización
          </Button>
        </AlertDescription>
      </Alert>
    );
  }
  if (!roadmap) {
    return <RoadmapCanvasLoading />;
  }
  if (!displayedRoadmap || !graphProjection) {
    return <RoadmapCanvasLoading isSimulation />;
  }
  const selectedNode = displayedRoadmap.nodes.find((node) => node.id === selectedNodeId);
  const addNodeAtOpenPosition = (
    node: NodeInput,
    findOpenPosition: (title: string) => { x: number; y: number } | null,
  ) => {
    const position = findOpenPosition(node.title);
    if (!position) return Promise.resolve(false);
    return canvasCommands.request({ kind: 'add-node', node, position });
  };
  const { isSidePanelOpen, activePanelWidth } = canvasPanelLayout(model, selectedNode);
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
        data-page-width="full"
        className={cn(
          'relative box-border grid min-h-[calc(100dvh-4rem)] min-w-0 flex-1 overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26/5%)] lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
          isSidePanelOpen ? 'lg:grid-cols-[minmax(0,1fr)_var(--sidebar-width)]' : 'lg:grid-cols-1',
        )}
      >
        <div
          ref={canvasFocusRef}
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[min(540px,calc(100dvh-4rem-2px))] bg-background lg:min-h-0"
        >
          {input.practice?.exitHref ? (
            <Link
              {...{ [TUTORIAL_EXIT_ATTRIBUTE]: '' }}
              className={buttonVariants({
                variant: 'outline',
                className: 'absolute top-4 right-4 z-20 sm:top-6 sm:right-6',
              })}
              href={input.practice.exitHref}
              onClick={markTutorialClosingPopover}
            >
              <LogOut data-icon="inline-start" />
              Salir
            </Link>
          ) : null}
          <NodeChangeCountsProvider
            roadmapId={roadmap.roadmap.id}
            openedNodeId={isSidePanelOpen ? selectedNodeId : null}
            enabled={fetchesRoadmapNotices(input) && !model.isCanvasPreview}
            simulatedCounts={model.isCanvasPreview ? undefined : input.practice?.nodeChangeCounts}
          >
            <RoadmapCanvasGraph
              model={model}
              input={input}
              addNodeAtOpenPosition={addNodeAtOpenPosition}
              roadmap={roadmap}
              displayedRoadmap={displayedRoadmap}
              graphProjection={graphProjection}
            />
          </NodeChangeCountsProvider>
          {error ? (
            <Button className="absolute top-24 right-5" type="button" onClick={retryRefresh}>
              Reintentar actualización
            </Button>
          ) : null}
        </div>
        <RoadmapCanvasPanels model={model} selectedNode={selectedNode} roadmap={roadmap} />
      </section>
      <RoadmapCanvasConfirmation model={model} />
    </SidebarProvider>
  );
}

function canvasPanelLayout(
  model: ReturnType<typeof useRoadmapCanvasController>,
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined,
) {
  const {
    canvasMode,
    isEditorOpen,
    teacherPreviewNode,
    isStudentExperience,
    isStudentDetailOpen,
    editorPanel,
    studentPanel,
  } = model;
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
  return { isSidePanelOpen, activePanelWidth };
}

function RoadmapCanvasConfirmation({
  model,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
}) {
  const {
    canvasCommands: { pending, cancel, confirm },
    roadmap,
  } = model;
  return (
    <ConfirmationDialog
      confirmation={pending && roadmap ? canvasConfirmation(pending, roadmap) : null}
      pendingActionId={pending?.phase === 'confirming' ? pending.choice : undefined}
      onCancel={cancel}
      // The dialog offers only the choices the canvas confirmation built from the module's.
      onAction={(choice) => void confirm(choice as CanvasConfirmationChoice)}
    />
  );
}

function RoadmapCanvasPanels({
  model,
  selectedNode,
  roadmap,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined;
  roadmap: NonNullable<ReturnType<typeof useRoadmapCanvasController>['roadmap']>;
}) {
  const {
    canEditRoadmap,
    canvasMode,
    isEditorOpen,
    editorPanel,
    nodeEditorRef,
    canvasCommands: { pending },
    resourceComposerCommand,
    performEditorEffect,
    handleNodeEditorIntent,
  } = model;
  return (
    <>
      {canEditRoadmap && (
        <NodeEditorPanel
          isOpen={canvasMode.isEditing && isEditorOpen}
          panelWidth={editorPanel.width}
          onPanelWidthChange={editorPanel.setWidth}
          expandRequest={resourceComposerCommand?.id}
        >
          <NodeEditor
            ref={nodeEditorRef}
            session={{
              node: selectedNode as RoadmapNode | undefined,
              nodeTypes: roadmap.nodeTypes,
              isVisibilityPending:
                (pending?.kind === 'hide-node' || pending?.kind === 'show-node') &&
                pending.phase !== 'awaiting',
            }}
            command={resourceComposerCommand ?? undefined}
            perform={performEditorEffect}
            onIntent={handleNodeEditorIntent}
          />
        </NodeEditorPanel>
      )}
      <RoadmapStudentPanel model={model} selectedNode={selectedNode} roadmap={roadmap} />
    </>
  );
}

function RoadmapStudentPanel({
  model,
  selectedNode,
  roadmap,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined;
  roadmap: NonNullable<ReturnType<typeof useRoadmapCanvasController>['roadmap']>;
}) {
  const {
    isStudentExperience,
    teacherPreviewNode,
    isStudentDetailOpen,
    isTeacherPreviewCompleted,
    closeTeacherPreview,
    closeSelectedNode,
    canvasPreviewWorkflow,
    dispatchCanvas,
    canvasCommands,
    isHistoricalRoadmap,
    editorPanel,
    studentPanel,
  } = model;
  return (
    <>
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
            else void canvasCommands.request({ kind: 'complete-node', nodeId: node.id });
          }}
          isReadOnly={isHistoricalRoadmap && !teacherPreviewNode}
          isTeacherPreview={Boolean(teacherPreviewNode)}
          nodeTypes={roadmap.nodeTypes}
          panelWidth={teacherPreviewNode ? editorPanel.width : studentPanel.width}
          onPanelWidthChange={teacherPreviewNode ? editorPanel.setWidth : studentPanel.setWidth}
        />
      )}
    </>
  );
}

function LostRoadmapAccess() {
  useEffect(() => {
    window.location.replace('/academic-overview?accessLost=1');
  }, []);
  return (
    <Alert role="status">
      <AlertDescription>
        Tu Participación ya no tiene acceso a este Roadmap. Volviendo al Resumen académico.
      </AlertDescription>
    </Alert>
  );
}

function RoadmapCanvasGraph({
  model,
  input,
  addNodeAtOpenPosition,
  roadmap,
  displayedRoadmap,
  graphProjection,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
  input: Props['input'];
  addNodeAtOpenPosition: (
    node: NodeInput,
    findOpenPosition: (title: string) => { x: number; y: number } | null,
  ) => Promise<boolean>;
  roadmap: NonNullable<ReturnType<typeof useRoadmapCanvasController>['roadmap']>;
  displayedRoadmap: NonNullable<ReturnType<typeof useRoadmapCanvasController>['displayedRoadmap']>;
  graphProjection: RoadmapGraphProjection;
}) {
  const {
    title,
    courseCode,
    year,
    semester,
    dispatchCanvas,
    focusReturnRequest,
    dismissSelectionNotice,
    selectedNodeId,
    guardEditorDraft,
    canvasCommands,
    canvasPreviewWorkflow,
    confirmedAutomaticLayout,
    canvasMode,
    isHistoricalRoadmap,
    isCanvasPreview,
    isStudentExperience,
    canEditRoadmap,
    canPreviewCanvas,
    canEnterCanvasPreview,
    canResetCanvasPreview,
    closeSelectedNode,
  } = model;
  return (
    <RoadmapGraph
      projection={graphProjection}
      notificationsEnabled={showsNodeChangeMarks(input)}
      onSelectNode={(nodeId) => {
        const node = displayedRoadmap.nodes.find((candidate) => candidate.id === nodeId);
        if (isStudentExperience && isStudentBlockedNode(node)) return;
        const select = () => {
          dismissSelectionNotice();
          input.practice?.onAction?.({ type: 'selectNode', nodeId });
          dispatchCanvas({
            type: 'selectNode',
            nodeId,
            panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
          });
        };
        if (canEditRoadmap && !isCanvasPreview && selectedNodeId && selectedNodeId !== nodeId) {
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
      onFitView={() => input.practice?.onAction?.({ type: 'fitView' })}
      onViewportChange={canvasPreviewWorkflow.onViewportChange}
      viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
      confirmedAutomaticLayout={confirmedAutomaticLayout}
      bottomLeftActions={
        !isCanvasPreview && (canEditRoadmap || canPreviewCanvas)
          ? () => (
              <>
                {canPreviewCanvas && !input.practice ? (
                  <Link
                    className={cn(buttonVariants({ variant: 'outline' }))}
                    href={versionHistoryUrl(courseCode)}
                  >
                    <History data-icon="inline-start" />
                    Historial de versiones
                  </Link>
                ) : null}
                {canPreviewCanvas && !input.practice ? (
                  <Link
                    className={cn(buttonVariants({ variant: 'outline' }))}
                    href={courseParticipantsUrl({ courseCode, year, semester })}
                  >
                    <Users data-icon="inline-start" />
                    Integrantes
                  </Link>
                ) : null}
                {canEnterCanvasPreview ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          ref={canvasPreviewWorkflow.entryButtonRef}
                          aria-label="Vista estudiante"
                          type="button"
                          variant="outline"
                          onClick={canvasPreviewWorkflow.requestEntry}
                        >
                          <Eye data-icon="inline-start" />
                          Vista estudiante
                        </Button>
                      }
                    />
                    <TooltipContent>Vista estudiante</TooltipContent>
                  </Tooltip>
                ) : null}
              </>
            )
          : undefined
      }
      bottomRightActions={
        !isCanvasPreview && canEditRoadmap
          ? (findOpenPosition) => (
              <NodeCreator
                nodeTypes={roadmap.nodeTypes}
                onSubmit={(node) => addNodeAtOpenPosition(node, findOpenPosition)}
                onCreateNodeType={(nodeType) =>
                  canvasCommands.request({ kind: 'add-node-type', nodeType })
                }
                onUpdateNodeType={(nodeTypeId, nodeType) =>
                  canvasCommands.request({ kind: 'update-node-type', nodeTypeId, nodeType })
                }
                onRequestDeleteNodeType={(nodeType) =>
                  void canvasCommands.request({ kind: 'delete-node-type', nodeTypeId: nodeType.id })
                }
              />
            )
          : undefined
      }
      overlaySlots={{
        topLeft: (
          <RoadmapCanvasHeader
            title={title}
            courseCode={courseCode}
            year={year}
            semester={semester}
            isCanvasPreview={isCanvasPreview}
            isEditing={canvasMode.isEditing}
          />
        ),
        topCenter: isCanvasPreview ? (
          <CanvasPreviewToolbar
            canReset={canResetCanvasPreview}
            isHistorical={isHistoricalRoadmap}
            onRequestReset={() => void canvasCommands.request({ kind: 'reset-canvas-preview' })}
            onExit={() => {
              if (!canvasPreviewWorkflow.isActive) return;
              canvasPreviewWorkflow.exit();
              input.practice?.onAction?.({ type: 'exitCanvasPreview' });
            }}
          />
        ) : null,
        topRight:
          isCanvasPreview || input.practice ? null : (
            <RoadmapTutorialLink
              experience={input.experience.kind}
              origin={roadmapPath(input.courseOffering.identifier)}
            />
          ),
      }}
    />
  );
}

function roadmapPath({
  courseCode,
  year,
  semester,
}: RoadmapCanvasSessionInput['courseOffering']['identifier']) {
  return `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}`;
}

/** The question-mark icon that opens the Roadmap tutorial of this experience. */
function RoadmapTutorialLink({
  experience,
  origin,
}: {
  experience: RoadmapCanvasSessionInput['experience']['kind'];
  origin: string;
}) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <Link
              {...{ [TUTORIAL_TRIGGER_ATTRIBUTE]: '' }}
              aria-label="Abrir tutorial"
              className={buttonVariants({ variant: 'outline', size: 'icon' })}
              href={`/practice-roadmap/${experience}?${new URLSearchParams({ origin })}`}
              // Rendering the Practice route records tutorial openings.
              prefetch={false}
            >
              <CircleHelp />
            </Link>
          }
        />
        <TooltipContent>Abrir tutorial</TooltipContent>
      </Tooltip>
      <TutorialClosingPopover />
    </>
  );
}

function RoadmapCanvasHeader({
  title,
  courseCode,
  year,
  semester,
  isCanvasPreview,
  isEditing,
}: Pick<
  ReturnType<typeof useRoadmapCanvasController>,
  'title' | 'courseCode' | 'year' | 'semester' | 'isCanvasPreview'
> & { isEditing: boolean }) {
  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        {isCanvasPreview ? (
          <Badge
            className="border-orange-300 text-secondary-foreground"
            style={{
              backgroundColor: 'color-mix(in srgb, var(--background) 78%, #f97316)',
            }}
          >
            Modo previsualización
          </Badge>
        ) : isEditing ? (
          <Badge variant="secondary">Modo edición</Badge>
        ) : null}
      </div>
      <h1 className="mt-2 font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] text-balance sm:text-[30px]">
        {title}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span>{courseCode}</span>
        <span aria-hidden="true">·</span>
        <span>{termLabel({ year, semester })}</span>
      </p>
    </header>
  );
}
