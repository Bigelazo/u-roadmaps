'use client';

import { IconTooltip } from '@/shared/ui/icon-tooltip';

import { NodeChangeCountsProvider } from '@/features/notifications/client';

import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { ArrowLeft, CircleAlert, CircleHelp, Eye, History, LogOut, UserGroup } from 'lucide-react';
import { courseParticipantsUrl, versionHistoryUrl } from '@/features/roadmap/client';
import { CanvasPreviewToolbar } from '@/features/roadmap/canvas/CanvasPreviewToolbar';
import { deriveCanvasMode } from '@/features/roadmap/canvas/mode';
import { canvasStateReducer, initialCanvasState } from '@/features/roadmap/canvas/state';
import {
  useNodeSelection,
  type NodeSelectionNotice,
} from '@/features/roadmap/canvas/node-selection';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import type {
  NodeEditorEffect,
  NodeEditorHandle,
  NodeEditorGuardReason,
  NodeEditorIntent,
  NodeEditorPerformResult,
  NodeCreationProgress,
  NodeInput,
  StagedResource,
} from '@/features/roadmap/editor/types';
import { NODE_RESOURCES_SECTION_ID } from '@/features/roadmap/editor/types';
import {
  createNodeWithResources,
  nodeCreationSummary,
} from '@/features/roadmap/session/node-creation';
import { NodeEditorPanel } from '@/features/roadmap/ui/NodeEditorPanel';
import {
  RoadmapGraph,
  type NewNodePlacement,
  type RoadmapGraphEditing,
  type RoadmapGraphEditingIntent,
  type RoadmapGraphProjection,
} from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import { useRoadmapCanvasSession } from '@/features/roadmap/session/session';
import type { CanvasCommand } from '@/features/roadmap/canvas/commands/canvas-command';
import { canvasConfirmation } from '@/features/roadmap/canvas/commands/use-canvas-commands';
import { useUnlockSchedule } from '@/features/roadmap/canvas/commands/use-unlock-schedule';
import type {
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { blockedPrerequisiteNodeIds } from '@/features/roadmap/domain/scheduled-unlock';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia } from '@/shared/ui/empty';
import { RoadmapCanvasLoading } from './RoadmapCanvasLoading';
import { notify } from '@/shared/ui/notify';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { buttonVariants } from '@/shared/ui/button-variants';
import { RoadmapPanelColumn } from '@/features/roadmap/ui/RoadmapPanelColumn';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';
import { useCompactCanvasLayout } from '@/features/roadmap/ui/compact-canvas-layout';
import {
  TUTORIAL_EXIT_ATTRIBUTE,
  TUTORIAL_TRIGGER_ATTRIBUTE,
  markTutorialClosingPopover,
} from '@/shared/client/tutorial/tutorial-support';
import { TutorialClosingPopover } from '@/shared/client/tutorial/tutorial-closing-popover';
import { useNotificationAcknowledgement } from '@/features/notifications/client';
import { termLabel } from '@/shared/course-offering';
import type { CanvasConfirmationChoice } from '@/features/roadmap/ui/roadmap-confirmation';

const NodeEditor = dynamic(
  () => import('@/features/roadmap/editor/NodeEditor').then(({ NodeEditor }) => NodeEditor),
  { ssr: false },
);

type Props = { input: RoadmapCanvasSessionInput };

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

const SELECTION_NOTICE_MESSAGES: Record<NodeSelectionNotice, string> = {
  'selected-node-blocked': 'El Nodo seleccionado ahora está bloqueado. Se cerró su detalle.',
  'selected-node-removed': 'El Nodo seleccionado ya no está disponible. Se cerró su detalle.',
};

function useRoadmapCanvasController({ input }: Props) {
  const { identifier, title } = input.courseOffering;
  const { courseCode, year, semester } = identifier;
  const [canvasState, dispatchCanvas] = useReducer(canvasStateReducer, initialCanvasState);
  const acknowledgedRoadmapRef = useRef<string | null>(null);
  const { acknowledge } = useNotificationAcknowledgement();
  const canvasFocusRef = useRef<HTMLDivElement>(null);
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const nodeEditorRef = useRef<NodeEditorHandle>(null);
  const guardEditorDraft = useCallback(
    (reason: NodeEditorGuardReason) =>
      nodeEditorRef.current?.guardDraft(reason) ?? Promise.resolve(true),
    [],
  );
  const hasEditorDraft = useCallback(() => Boolean(nodeEditorRef.current?.hasDraft?.()), []);
  const followAppliedCommandRef = useRef<(command: CanvasCommand, createdNodeId?: string) => void>(
    () => {},
  );
  const followAppliedCommand = useCallback(
    (command: CanvasCommand, createdNodeId?: string) =>
      followAppliedCommandRef.current(command, createdNodeId),
    [],
  );
  const {
    roadmap,
    error,
    dismissError,
    accessLost,
    canvasCommands,
    canvasPreviewRoadmap,
    canvasPreviewWorkflow,
    accessResource,
    isClosed,
  } = useRoadmapCanvasSession(input, {
    guardDraft: guardEditorDraft,
    onCommandApplied: followAppliedCommand,
    canvas: { state: canvasState, dispatch: dispatchCanvas },
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

  const displayedRoadmap = isCanvasPreview ? canvasPreviewRoadmap : roadmap;
  const nodeSelection = useNodeSelection({
    canvas: { state: canvasState, dispatch: dispatchCanvas },
    nodes: displayedRoadmap?.nodes,
    mode: canvasMode,
    guardDraft: guardEditorDraft,
    hasDraft: hasEditorDraft,
    reportPracticeAction: input.practice?.onAction,
  });
  useEffect(() => {
    followAppliedCommandRef.current = nodeSelection.followAppliedCommand;
  });
  const { selectedNodeId, panel, dismissTopmostPanel, focusReturn } = nodeSelection;

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissTopmostPanel()) event.preventDefault();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dismissTopmostPanel]);

  useEffect(() => {
    if (focusReturn?.destination !== 'canvas') return;
    requestAnimationFrame(() => canvasFocusRef.current?.focus());
  }, [focusReturn]);

  useStateToast(
    'neutral',
    'roadmap-selection-notice',
    nodeSelection.notice ? SELECTION_NOTICE_MESSAGES[nodeSelection.notice] : null,
    nodeSelection.dismissNotice,
  );
  const acknowledgesRoadmap = fetchesRoadmapNotices(input);
  useEffect(() => {
    if (!acknowledgesRoadmap || !roadmap || isCanvasPreview) return;
    const roadmapId = roadmap.roadmap.id;
    if (acknowledgedRoadmapRef.current === roadmapId) return;
    acknowledgedRoadmapRef.current = roadmapId;
    const operation = { roadmapId, entryKey: input.roadmapEntryKey };
    void acknowledge(operation);
  }, [acknowledge, acknowledgesRoadmap, input.roadmapEntryKey, isCanvasPreview, roadmap]);
  const { closeSelectedNode, showNodeInformationPreview, openResourceComposer } = nodeSelection;
  const handleNodeEditorIntent = useCallback(
    (intent: NodeEditorIntent) => {
      switch (intent.kind) {
        case 'close':
          void closeSelectedNode({ guardDraft: false });
          return;
        case 'preview-node-information':
          showNodeInformationPreview(intent.node, intent.returnFocus);
          return;
        default:
          void request(intent);
      }
    },
    [closeSelectedNode, request, showNodeInformationPreview],
  );
  const handleGraphEditingIntent = useCallback(
    (intent: RoadmapGraphEditingIntent) => {
      if (intent.kind === 'add-resource') void openResourceComposer(intent.nodeId);
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
    nodeSelection,
    canvasFocusRef,
    selectedNodeId,
    panel,
    editorPanel,
    studentPanel,
    nodeEditorRef,
    roadmap,
    error,
    dismissError,
    accessLost,
    canvasCommands,
    canvasPreviewWorkflow,
    accessResource,
    performEditorEffect,
    canvasMode,
    isHistoricalRoadmap,
    isCanvasPreview,
    isStudentExperience,
    canEditRoadmap,
    canPreviewCanvas,
    canEnterCanvasPreview,
    canResetCanvasPreview,
    displayedRoadmap,
    handleNodeEditorIntent,
    graphProjection,
  };
}

function revealNodeResources() {
  requestAnimationFrame(() =>
    document
      .getElementById(NODE_RESOURCES_SECTION_ID)
      ?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }),
  );
}

function fetchesRoadmapNotices(input: RoadmapCanvasSessionInput) {
  return Boolean(input.notificationsEnabled) && !input.practice;
}

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
    dismissError,
    accessLost,
    canvasCommands,
    displayedRoadmap,
    graphProjection,
  } = model;

  if (accessLost) {
    return <LostRoadmapAccess />;
  }
  if (error && !roadmap) {
    return <RoadmapLoadError input={input} error={error} />;
  }
  if (!roadmap) {
    return <RoadmapCanvasLoading />;
  }
  if (!displayedRoadmap || !graphProjection) {
    return <RoadmapCanvasLoading isCanvasPreview />;
  }
  const selectedNode = displayedRoadmap.nodes.find((node) => node.id === selectedNodeId);
  const addNodeAtOpenPosition = async (
    node: NodeInput,
    resources: readonly StagedResource[],
    placeNewNode: (title: string) => NewNodePlacement,
    onProgress: (progress: NodeCreationProgress) => void,
  ) => {
    const outcome = await createNodeWithResources(
      canvasCommands.run,
      { kind: 'add-node', node, ...placeNewNode(node.title) },
      resources,
      onProgress,
    );
    if (!outcome) return false;
    const summary = nodeCreationSummary(resources.length, outcome.failed);
    if (summary?.tone === 'error') {
      dismissError();
      notify.error(summary.message);
      if (outcome.nodeId) {
        model.nodeSelection.openEditor(outcome.nodeId);
        revealNodeResources();
      }
    } else if (summary) {
      notify.success(summary.message);
    }
    return true;
  };
  const { isSidePanelOpen, activePanelWidth } = canvasPanelLayout(model, selectedNode);
  return (
    <SidebarProvider className="min-h-0 flex-1">
      <section
        data-page-width="full"
        className="relative box-border grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)] overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26/5%)] lg:grid-cols-[minmax(0,1fr)_auto]"
      >
        <div
          ref={canvasFocusRef}
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-0 bg-background"
        >
          {input.practice?.exitHref ? (
            <Link
              {...{ [TUTORIAL_EXIT_ATTRIBUTE]: '' }}
              className={buttonVariants({
                variant: 'outline',
                className: cn(
                  'absolute top-4 right-4 z-10 sm:top-6 sm:right-6',
                  model.isCanvasPreview &&
                    'max-lg:top-auto max-lg:bottom-[18px] sm:max-lg:bottom-6',
                ),
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
              graphProjection={graphProjection}
            />
          </NodeChangeCountsProvider>
        </div>
        <RoadmapPanelColumn
          isOpen={isSidePanelOpen}
          width={activePanelWidth}
          scene={model.isCanvasPreview ? 'canvas-preview' : 'roadmap'}
        >
          <RoadmapCanvasPanels model={model} selectedNode={selectedNode} roadmap={roadmap} />
        </RoadmapPanelColumn>
      </section>
      <RoadmapCanvasConfirmation model={model} />
    </SidebarProvider>
  );
}

function canvasPanelLayout(
  model: ReturnType<typeof useRoadmapCanvasController>,
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined,
) {
  const { canvasMode, panel, isStudentExperience, editorPanel, studentPanel } = model;
  const isNodeInformationPreview = panel.kind === 'node-information-preview';
  const isEditorPanelOpen = canvasMode.isEditing && panel.kind === 'editor';
  const isStudentPanelOpen =
    isNodeInformationPreview ||
    (isStudentExperience &&
      panel.kind === 'student-detail' &&
      Boolean(selectedNode) &&
      !isStudentBlockedNode(selectedNode));
  const isSidePanelOpen = isEditorPanelOpen || isStudentPanelOpen;
  const activePanelWidth =
    isNodeInformationPreview || isEditorPanelOpen ? editorPanel.width : studentPanel.width;
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
  const schedule = useUnlockSchedule(pending?.request);
  return (
    <ConfirmationDialog
      confirmation={
        pending && roadmap
          ? canvasConfirmation(pending, roadmap, { schedule: schedule.draft })
          : null
      }
      pendingActionId={pending?.phase === 'confirming' ? pending.choice : undefined}
      onCancel={cancel}
      onAction={(choice) => void confirm(choice as CanvasConfirmationChoice, schedule.input)}
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
    canvasMode,
    panel,
    editorPanel,
    nodeEditorRef,
    canvasCommands: { pending },
    performEditorEffect,
    handleNodeEditorIntent,
  } = model;
  const editedNode = selectedNode && 'isTeacherBlocked' in selectedNode ? selectedNode : undefined;
  return (
    <>
      {canvasMode.isEditing && (
        <NodeEditorPanel
          isOpen={canvasMode.isEditing && panel.kind === 'editor'}
          panelWidth={editorPanel.width}
          onPanelWidthChange={editorPanel.setWidth}
        >
          <NodeEditor
            ref={nodeEditorRef}
            session={{
              node: editedNode,
              nodeTypes: roadmap.nodeTypes,
              blockedPrerequisites: editedNode
                ? blockedPrerequisiteNodeIds({
                    nodes: roadmap.nodes.filter(
                      (node): node is RoadmapNode => 'isTeacherBlocked' in node,
                    ),
                    dependencies: roadmap.dependencies,
                    nodeId: editedNode.id,
                  }).length
                : 0,
              isVisibilityPending:
                (pending?.kind === 'hide-node' || pending?.kind === 'show-node') &&
                pending.phase !== 'awaiting',
            }}
            command={panel.kind === 'editor' ? panel.resourceComposerCommand : undefined}
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
    panel,
    nodeSelection,
    canvasPreviewWorkflow,
    canvasCommands,
    accessResource,
    isHistoricalRoadmap,
    editorPanel,
    studentPanel,
  } = model;
  const nodeInformationPreview = panel.kind === 'node-information-preview' ? panel : null;
  const nodeInformationPreviewNode = nodeInformationPreview?.node;
  const isStudentDetailOpen = panel.kind === 'student-detail';
  return (
    <>
      {(isStudentExperience || nodeInformationPreviewNode) && (
        <StudentNodeDetail
          node={
            nodeInformationPreviewNode ??
            (isStudentDetailOpen ? (selectedNode as StudentRoadmapNode | undefined) : undefined)
          }
          status={
            nodeInformationPreviewNode
              ? nodeInformationPreview.isCompleted
                ? 'completed'
                : 'available'
              : isStudentDetailOpen && selectedNode
                ? studentNodeStatus(selectedNode)
                : null
          }
          onClose={
            nodeInformationPreviewNode
              ? nodeSelection.closeNodeInformationPreview
              : () => void nodeSelection.closeSelectedNode()
          }
          onComplete={(node) => {
            if (canvasPreviewWorkflow.completeNode(node.id)) return;
            if (nodeInformationPreviewNode) nodeSelection.completeNodeInformationPreview();
            else void canvasCommands.request({ kind: 'complete-node', nodeId: node.id });
          }}
          onResourceAccess={accessResource}
          isReadOnly={isHistoricalRoadmap && !nodeInformationPreviewNode}
          isNodeInformationPreview={Boolean(nodeInformationPreviewNode)}
          nodeTypes={roadmap.nodeTypes}
          panelWidth={nodeInformationPreviewNode ? editorPanel.width : studentPanel.width}
          onPanelWidthChange={
            nodeInformationPreviewNode ? editorPanel.setWidth : studentPanel.setWidth
          }
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
  graphProjection,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
  input: Props['input'];
  addNodeAtOpenPosition: (
    node: NodeInput,
    resources: readonly StagedResource[],
    placeNewNode: (title: string) => NewNodePlacement,
    onProgress: (progress: NodeCreationProgress) => void,
  ) => Promise<boolean>;
  roadmap: NonNullable<ReturnType<typeof useRoadmapCanvasController>['roadmap']>;
  graphProjection: RoadmapGraphProjection;
}) {
  const {
    title,
    courseCode,
    year,
    semester,
    nodeSelection,
    selectedNodeId,
    canvasCommands,
    canvasPreviewWorkflow,
    canvasMode,
    isHistoricalRoadmap,
    isCanvasPreview,
    canEditRoadmap,
    canPreviewCanvas,
    canEnterCanvasPreview,
    canResetCanvasPreview,
  } = model;
  const { focusReturn } = nodeSelection;
  const isCompactLayout = useCompactCanvasLayout();
  return (
    <RoadmapGraph
      projection={graphProjection}
      notificationsEnabled={showsNodeChangeMarks(input)}
      onSelectNode={(nodeId) => void nodeSelection.selectNode(nodeId)}
      selectedNodeId={selectedNodeId}
      focusReturnRequest={focusReturn?.destination === 'node' ? focusReturn.token : null}
      onClearSelectedNode={() => void nodeSelection.closeSelectedNode()}
      onFitView={() => input.practice?.onAction?.({ type: 'fitView' })}
      onViewportChange={canvasPreviewWorkflow.onViewportChange}
      viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
      bottomLeftActions={
        !isCanvasPreview && (canEditRoadmap || canPreviewCanvas)
          ? () => (
              <>
                {canEnterCanvasPreview ? (
                  <IconTooltip
                    label="Vista estudiante"
                    iconOnly={isCompactLayout}
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
                ) : null}
              </>
            )
          : undefined
      }
      bottomRightActions={
        !isCanvasPreview && canEditRoadmap
          ? (placeNewNode) => (
              <NodeCreator
                nodeTypes={roadmap.nodeTypes}
                nodes={roadmap.nodes}
                onSubmit={(node, resources, onProgress) =>
                  addNodeAtOpenPosition(node, resources, placeNewNode, onProgress)
                }
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
            showsCourseLinks={canPreviewCanvas && !isCanvasPreview && !input.practice}
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

function RoadmapTutorialLink({
  experience,
  origin,
}: {
  experience: RoadmapCanvasSessionInput['experience']['kind'];
  origin: string;
}) {
  return (
    <>
      <IconTooltip
        label="Abrir tutorial"
        delay={150}
        render={
          <Link
            {...{ [TUTORIAL_TRIGGER_ATTRIBUTE]: '' }}
            aria-label="Abrir tutorial"
            className={buttonVariants({ variant: 'outline', size: 'icon' })}
            href={`/practice-roadmap/${experience}?${new URLSearchParams({ origin })}`}
            prefetch={false}
          >
            <CircleHelp />
          </Link>
        }
      />
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
  showsCourseLinks,
}: Pick<
  ReturnType<typeof useRoadmapCanvasController>,
  'title' | 'courseCode' | 'year' | 'semester' | 'isCanvasPreview'
> & { isEditing: boolean; showsCourseLinks: boolean }) {
  const isCompact = useCompactCanvasLayout();
  const hidesBadgeRow = isCanvasPreview && isCompact;
  return (
    <header>
      <div className={cn('flex flex-wrap items-center gap-2', hidesBadgeRow && 'hidden')}>
        {isCanvasPreview ? (
          <Badge className="bg-[color-mix(in_srgb,var(--background)_78%,#f97316)] text-secondary-foreground dark:bg-warning-soft">
            Modo previsualización
          </Badge>
        ) : isEditing ? (
          <Badge variant="secondary">Modo edición</Badge>
        ) : null}
      </div>
      <h1
        className={cn(
          'font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] text-balance sm:text-[30px]',
          !hidesBadgeRow && 'mt-2',
        )}
      >
        {title}
      </h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
        <span>{courseCode}</span>
        <span aria-hidden="true">·</span>
        <span>{termLabel({ year, semester })}</span>
      </p>
      {showsCourseLinks ? (
        <RoadmapCourseLinks courseCode={courseCode} year={year} semester={semester} />
      ) : null}
    </header>
  );
}

function RoadmapCourseLinks({
  courseCode,
  year,
  semester,
}: Pick<ReturnType<typeof useRoadmapCanvasController>, 'courseCode' | 'year' | 'semester'>) {
  const linkClassName = cn(
    buttonVariants({ variant: 'ghost', size: 'sm' }),
    'pointer-events-auto justify-start text-primary hover:bg-primary-soft/50 hover:text-primary-deep',
  );
  return (
    <nav
      aria-label="Secciones del curso"
      className="-mx-3 mt-2 -mb-2 flex flex-wrap gap-1 border-t border-border/70 p-1 [@media(max-height:500px)]:mt-1 [@media(max-height:500px)]:-mb-1.5"
    >
      <Link className={linkClassName} href={versionHistoryUrl(courseCode)}>
        <History data-icon="inline-start" />
        Versiones
      </Link>
      <Link className={linkClassName} href={courseParticipantsUrl({ courseCode, year, semester })}>
        <UserGroup data-icon="inline-start" />
        Integrantes
      </Link>
    </nav>
  );
}

function RoadmapLoadError({ input, error }: Props & { error: string }) {
  return (
    <section
      data-page-width="full"
      aria-labelledby="roadmap-load-error-title"
      className="flex min-h-full w-full flex-1 bg-cloud text-foreground"
    >
      <Empty className="gap-6 rounded-none px-6 py-16">
        <EmptyHeader className="max-w-lg gap-4">
          <EmptyMedia className="text-destructive">
            <CircleAlert aria-hidden="true" className="size-10" />
          </EmptyMedia>
          <h1
            id="roadmap-load-error-title"
            className="font-heading text-2xl font-semibold tracking-tight text-balance sm:text-3xl"
          >
            No pudimos abrir el roadmap
          </h1>
          <p className="max-w-full text-base font-medium wrap-anywhere">
            {input.courseOffering.title}
          </p>
          <div
            role="alert"
            className="flex max-w-full flex-col gap-2 text-base text-muted-foreground"
          >
            <p className="wrap-anywhere">{error}</p>
            <p>
              {input.practice?.exitHref
                ? 'Vuelve a la práctica para continuar.'
                : 'Vuelve a tus cursos para abrir el roadmap nuevamente.'}
            </p>
          </div>
        </EmptyHeader>
        <Link href={input.practice?.exitHref ?? '/academic-overview'} className={buttonVariants()}>
          <ArrowLeft data-icon="inline-start" />
          {input.practice?.exitHref ? 'Volver a la práctica' : 'Volver a mis cursos'}
        </Link>
      </Empty>
    </section>
  );
}
