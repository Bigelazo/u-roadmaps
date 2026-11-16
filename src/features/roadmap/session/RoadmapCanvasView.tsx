'use client';

import { IconTooltip } from '@/shared/ui/icon-tooltip';

import { NodeChangeCountsProvider } from '@/features/notifications/client';

import { useCallback, useEffect, useMemo, useRef, type RefObject } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { CircleHelp, Eye, LogOut } from 'lucide-react';
import { CanvasPreviewToolbar } from '@/features/roadmap/canvas/CanvasPreviewToolbar';
import { deriveCanvasMode, type CanvasMode } from '@/features/roadmap/canvas/mode';
import {
  useNodeSelection,
  type NodeSelectionFocusReturn,
  type NodeSelectionNotice,
  type NodeSelectionPanel,
} from '@/features/roadmap/canvas/node-selection';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import type {
  NodeEditorCommand,
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
  type RoadmapGraphProps,
} from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { studentNodeStatus } from '@/features/roadmap/student/node-status';
import { useRoadmapCanvasSession } from '@/features/roadmap/session/session';
import type { CanvasCommand } from '@/features/roadmap/canvas/commands/canvas-command';
import {
  canvasConfirmation,
  type CanvasCommands,
} from '@/features/roadmap/canvas/commands/use-canvas-commands';
import { useUnlockSchedule } from '@/features/roadmap/canvas/commands/use-unlock-schedule';
import type {
  AnyRoadmapDto,
  Resource,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { blockedPrerequisiteNodeIds } from '@/features/roadmap/domain/scheduled-unlock';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { RoadmapCanvasLoading } from './RoadmapCanvasLoading';
import { RoadmapCanvasHeader, RoadmapLoadError } from './RoadmapCanvasHeader';
import { useCanvasPanelLayout } from './canvas-panel-layout';
import { notify } from '@/shared/ui/notify';
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
import type { CanvasConfirmationChoice } from '@/features/roadmap/ui/roadmap-confirmation';

const NodeEditor = dynamic(
  () => import('@/features/roadmap/editor/NodeEditor').then(({ NodeEditor }) => NodeEditor),
  { ssr: false },
);

type Props = { input: RoadmapCanvasSessionInput };

type AddNodeAtOpenPosition = (
  node: NodeInput,
  resources: readonly StagedResource[],
  placeNewNode: (title: string) => NewNodePlacement,
  onProgress: (progress: NodeCreationProgress) => void,
) => Promise<boolean>;

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

function useNodeEditorHandle() {
  const nodeEditorRef = useRef<NodeEditorHandle>(null);
  const guardEditorDraft = useCallback(
    (reason: NodeEditorGuardReason) =>
      nodeEditorRef.current?.guardDraft(reason) ?? Promise.resolve(true),
    [],
  );
  const hasEditorDraft = useCallback(() => Boolean(nodeEditorRef.current?.hasDraft?.()), []);
  return { nodeEditorRef, guardEditorDraft, hasEditorDraft };
}

function useLateCommandFollower() {
  const followAppliedCommandRef = useRef<(command: CanvasCommand, createdNodeId?: string) => void>(
    () => {},
  );
  const followAppliedCommand = useCallback(
    (command: CanvasCommand, createdNodeId?: string) =>
      followAppliedCommandRef.current(command, createdNodeId),
    [],
  );
  return { followAppliedCommandRef, followAppliedCommand };
}

function useEscapeDismissal(dismissTopmostPanel: () => boolean) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissTopmostPanel()) event.preventDefault();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [dismissTopmostPanel]);
}

function useCanvasFocusReturn(focusReturn: NodeSelectionFocusReturn | null) {
  const canvasFocusRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (focusReturn?.destination !== 'canvas') return;
    requestAnimationFrame(() => canvasFocusRef.current?.focus());
  }, [focusReturn]);
  return canvasFocusRef;
}

function useRoadmapAcknowledgement(
  input: RoadmapCanvasSessionInput,
  roadmap: AnyRoadmapDto | null,
  isCanvasPreview: boolean,
) {
  const acknowledgedRoadmapRef = useRef<string | null>(null);
  const { acknowledge } = useNotificationAcknowledgement();
  const acknowledgesRoadmap = fetchesRoadmapNotices(input);
  useEffect(() => {
    if (!acknowledgesRoadmap || !roadmap || isCanvasPreview) return;
    const roadmapId = roadmap.roadmap.id;
    if (acknowledgedRoadmapRef.current === roadmapId) return;
    acknowledgedRoadmapRef.current = roadmapId;
    const operation = { roadmapId, entryKey: input.roadmapEntryKey };
    void acknowledge(operation);
  }, [acknowledge, acknowledgesRoadmap, input.roadmapEntryKey, isCanvasPreview, roadmap]);
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
  const { nodeEditorRef, guardEditorDraft, hasEditorDraft } = useNodeEditorHandle();
  const { followAppliedCommandRef, followAppliedCommand } = useLateCommandFollower();
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
  const { isCanvasPreview, isStudentExperience } = canvasMode;

  const displayedRoadmap = isCanvasPreview ? canvasPreviewRoadmap : roadmap;
  const nodeSelection = useNodeSelection({
    nodes: displayedRoadmap?.nodes,
    mode: canvasMode,
    guardDraft: guardEditorDraft,
    hasDraft: hasEditorDraft,
    reportPracticeAction: input.practice?.onAction,
  });
  useEffect(() => {
    followAppliedCommandRef.current = nodeSelection.followAppliedCommand;
  });
  const {
    selectedNodeId,
    panel,
    focusReturn,
    dismissTopmostPanel,
    closeSelectedNode,
    showNodeInformationPreview,
    openResourceComposer,
  } = nodeSelection;
  useEscapeDismissal(dismissTopmostPanel);
  const canvasFocusRef = useCanvasFocusReturn(focusReturn);
  useStateToast(
    'neutral',
    'roadmap-selection-notice',
    nodeSelection.notice ? SELECTION_NOTICE_MESSAGES[nodeSelection.notice] : null,
    nodeSelection.dismissNotice,
  );
  useRoadmapAcknowledgement(input, roadmap, isCanvasPreview);

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

  const selectedNode = displayedRoadmap?.nodes.find((node) => node.id === selectedNodeId);
  const panelLayout = useCanvasPanelLayout({ panel, mode: canvasMode, selectedNode });

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
  const addNodeAtOpenPosition: AddNodeAtOpenPosition = async (
    node,
    resources,
    placeNewNode,
    onProgress,
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
        nodeSelection.openEditor(outcome.nodeId);
        revealNodeResources();
      }
    } else if (summary) {
      notify.success(summary.message);
    }
    return true;
  };
  const completeStudentPanelNode = (nodeId: string) => {
    if (canvasPreviewWorkflow.completeNode(nodeId)) return;
    if (panel.kind === 'node-information-preview') nodeSelection.completeNodeInformationPreview();
    else void request({ kind: 'complete-node', nodeId });
  };
  const exitCanvasPreview = () => {
    if (!canvasPreviewWorkflow.isActive) return;
    canvasPreviewWorkflow.exit();
    input.practice?.onAction?.({ type: 'exitCanvasPreview' });
  };
  const { pending } = canvasCommands;
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
                  isCanvasPreview && 'max-lg:top-auto max-lg:bottom-[18px] sm:max-lg:bottom-6',
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
            openedNodeId={panelLayout.openPanel ? selectedNodeId : null}
            enabled={fetchesRoadmapNotices(input) && !isCanvasPreview}
            simulatedCounts={isCanvasPreview ? undefined : input.practice?.nodeChangeCounts}
          >
            <RoadmapCanvasGraph
              input={input}
              projection={graphProjection}
              roadmap={roadmap}
              mode={canvasMode}
              selectedNodeId={selectedNodeId}
              focusReturn={focusReturn}
              onSelectNode={(nodeId) => void nodeSelection.selectNode(nodeId)}
              onClearSelectedNode={() => void closeSelectedNode()}
              request={request}
              addNodeAtOpenPosition={addNodeAtOpenPosition}
              onViewportChange={canvasPreviewWorkflow.onViewportChange}
              viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
              canvasPreviewEntryButtonRef={canvasPreviewWorkflow.entryButtonRef}
              onRequestCanvasPreviewEntry={canvasPreviewWorkflow.requestEntry}
              onExitCanvasPreview={exitCanvasPreview}
            />
          </NodeChangeCountsProvider>
        </div>
        <RoadmapPanelColumn
          isOpen={panelLayout.openPanel !== null}
          width={panelLayout.width}
          scene={isCanvasPreview ? 'canvas-preview' : 'roadmap'}
        >
          {canvasMode.isEditing && (
            <RoadmapNodeEditorPanel
              isOpen={panelLayout.openPanel === 'editor'}
              width={panelLayout.width}
              onWidthChange={panelLayout.setWidth}
              nodeEditorRef={nodeEditorRef}
              roadmap={roadmap}
              selectedNode={selectedNode}
              isVisibilityPending={
                (pending?.kind === 'hide-node' || pending?.kind === 'show-node') &&
                pending.phase !== 'awaiting'
              }
              command={panel.kind === 'editor' ? panel.resourceComposerCommand : undefined}
              perform={performEditorEffect}
              onIntent={handleNodeEditorIntent}
            />
          )}
          <RoadmapStudentPanel
            panel={panel}
            selectedNode={selectedNode}
            nodeTypes={roadmap.nodeTypes}
            isStudentExperience={isStudentExperience}
            isHistorical={canvasMode.isHistorical}
            width={panelLayout.width}
            onWidthChange={panelLayout.setWidth}
            onCloseSelectedNode={() => void closeSelectedNode()}
            onCloseNodeInformationPreview={nodeSelection.closeNodeInformationPreview}
            onComplete={completeStudentPanelNode}
            onResourceAccess={accessResource}
          />
        </RoadmapPanelColumn>
      </section>
      <RoadmapCanvasConfirmation
        pending={pending}
        roadmap={roadmap}
        onCancel={canvasCommands.cancel}
        onConfirm={canvasCommands.confirm}
      />
    </SidebarProvider>
  );
}

function RoadmapCanvasConfirmation({
  pending,
  roadmap,
  onCancel,
  onConfirm,
}: {
  pending: CanvasCommands['pending'];
  roadmap: AnyRoadmapDto;
  onCancel: CanvasCommands['cancel'];
  onConfirm: CanvasCommands['confirm'];
}) {
  const schedule = useUnlockSchedule(pending?.request);
  return (
    <ConfirmationDialog
      confirmation={
        pending ? canvasConfirmation(pending, roadmap, { schedule: schedule.draft }) : null
      }
      pendingActionId={pending?.phase === 'confirming' ? pending.choice : undefined}
      onCancel={onCancel}
      onAction={(choice) => void onConfirm(choice as CanvasConfirmationChoice, schedule.input)}
    />
  );
}

function RoadmapNodeEditorPanel({
  isOpen,
  width,
  onWidthChange,
  nodeEditorRef,
  roadmap,
  selectedNode,
  isVisibilityPending,
  command,
  perform,
  onIntent,
}: {
  isOpen: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  nodeEditorRef: RefObject<NodeEditorHandle | null>;
  roadmap: AnyRoadmapDto;
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined;
  isVisibilityPending: boolean;
  command: NodeEditorCommand | undefined;
  perform: (effect: NodeEditorEffect) => Promise<NodeEditorPerformResult>;
  onIntent: (intent: NodeEditorIntent) => void;
}) {
  const editedNode = selectedNode && 'isTeacherBlocked' in selectedNode ? selectedNode : undefined;
  return (
    <NodeEditorPanel isOpen={isOpen} panelWidth={width} onPanelWidthChange={onWidthChange}>
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
          isVisibilityPending,
        }}
        command={command}
        perform={perform}
        onIntent={onIntent}
      />
    </NodeEditorPanel>
  );
}

function RoadmapStudentPanel({
  panel,
  selectedNode,
  nodeTypes,
  isStudentExperience,
  isHistorical,
  width,
  onWidthChange,
  onCloseSelectedNode,
  onCloseNodeInformationPreview,
  onComplete,
  onResourceAccess,
}: {
  panel: NodeSelectionPanel;
  selectedNode: RoadmapNode | StudentRoadmapNode | undefined;
  nodeTypes: AnyRoadmapDto['nodeTypes'];
  isStudentExperience: boolean;
  isHistorical: boolean;
  width: number;
  onWidthChange: (width: number) => void;
  onCloseSelectedNode: () => void;
  onCloseNodeInformationPreview: () => void;
  onComplete: (nodeId: string) => void;
  onResourceAccess: (resource: Resource) => void;
}) {
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
          onClose={nodeInformationPreviewNode ? onCloseNodeInformationPreview : onCloseSelectedNode}
          onComplete={(node) => onComplete(node.id)}
          onResourceAccess={onResourceAccess}
          isReadOnly={isHistorical && !nodeInformationPreviewNode}
          isNodeInformationPreview={Boolean(nodeInformationPreviewNode)}
          nodeTypes={nodeTypes}
          panelWidth={width}
          onPanelWidthChange={onWidthChange}
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
  input,
  projection,
  roadmap,
  mode,
  selectedNodeId,
  focusReturn,
  onSelectNode,
  onClearSelectedNode,
  request,
  addNodeAtOpenPosition,
  onViewportChange,
  viewportRestoration,
  canvasPreviewEntryButtonRef,
  onRequestCanvasPreviewEntry,
  onExitCanvasPreview,
}: {
  input: RoadmapCanvasSessionInput;
  projection: RoadmapGraphProjection;
  roadmap: AnyRoadmapDto;
  mode: CanvasMode;
  selectedNodeId: string | null;
  focusReturn: NodeSelectionFocusReturn | null;
  onSelectNode: (nodeId: string) => void;
  onClearSelectedNode: () => void;
  request: CanvasCommands['request'];
  addNodeAtOpenPosition: AddNodeAtOpenPosition;
  onViewportChange: RoadmapGraphProps['onViewportChange'];
  viewportRestoration: RoadmapGraphProps['viewportRestoration'];
  canvasPreviewEntryButtonRef: RefObject<HTMLButtonElement | null>;
  onRequestCanvasPreviewEntry: () => void;
  onExitCanvasPreview: () => void;
}) {
  const { isCanvasPreview, isHistorical } = mode;
  const { canEditRoadmap, canPreviewCanvas, canEnterCanvasPreview, canResetCanvasPreview } =
    mode.capabilities;
  const { courseOffering } = input;
  const isCompactLayout = useCompactCanvasLayout();
  return (
    <RoadmapGraph
      projection={projection}
      notificationsEnabled={showsNodeChangeMarks(input)}
      onSelectNode={onSelectNode}
      selectedNodeId={selectedNodeId}
      focusReturnRequest={focusReturn?.destination === 'node' ? focusReturn.token : null}
      onClearSelectedNode={onClearSelectedNode}
      onFitView={() => input.practice?.onAction?.({ type: 'fitView' })}
      onViewportChange={onViewportChange}
      viewportRestoration={viewportRestoration}
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
                        ref={canvasPreviewEntryButtonRef}
                        aria-label="Vista estudiante"
                        type="button"
                        variant="outline"
                        onClick={onRequestCanvasPreviewEntry}
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
                onCreateNodeType={(nodeType) => request({ kind: 'add-node-type', nodeType })}
                onUpdateNodeType={(nodeTypeId, nodeType) =>
                  request({ kind: 'update-node-type', nodeTypeId, nodeType })
                }
                onRequestDeleteNodeType={(nodeType) =>
                  void request({ kind: 'delete-node-type', nodeTypeId: nodeType.id })
                }
              />
            )
          : undefined
      }
      overlaySlots={{
        topLeft: (
          <RoadmapCanvasHeader
            title={courseOffering.title}
            {...courseOffering.identifier}
            isCanvasPreview={isCanvasPreview}
            isEditing={mode.isEditing}
            showsCourseLinks={canPreviewCanvas && !isCanvasPreview && !input.practice}
          />
        ),
        topCenter: isCanvasPreview ? (
          <CanvasPreviewToolbar
            canReset={canResetCanvasPreview}
            isHistorical={isHistorical}
            onRequestReset={() => void request({ kind: 'reset-canvas-preview' })}
            onExit={onExitCanvasPreview}
          />
        ) : null,
        topRight:
          isCanvasPreview || input.practice ? null : (
            <RoadmapTutorialLink
              experience={input.experience.kind}
              origin={roadmapPath(courseOffering.identifier)}
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
