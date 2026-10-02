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
import { CircleAlert, Eye, PanelRightClose, PanelRightOpen, X } from 'lucide-react';
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
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { RoadmapCanvasSessionInput } from '@/features/roadmap/session/types';
import { Alert, AlertAction, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';
import { useNotificationAcknowledgement } from '@/features/notifications/client';
import { NotificationCountButton } from '@/features/notifications/client';
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

type Props = { input: RoadmapCanvasSessionInput };

function useRoadmapCanvasController({ input }: Props) {
  const { identifier, title } = input.courseOffering;
  const { courseCode, year, semester } = identifier;
  const [canvasState, dispatchCanvas] = useReducer(canvasStateReducer, initialCanvasState);
  const [focusReturnRequest, setFocusReturnRequest] = useState<string | null>(null);
  const [syncedSelectionNotice, setSyncedSelectionNotice] = useState<string | null>(null);
  const [acknowledgementError, setAcknowledgementError] = useState(false);
  const acknowledgementInputRef = useRef<{
    roadmapId: string;
    openingId?: string | null;
    nodeId?: string;
    accessibleNodeIds?: ReadonlySet<string>;
  } | null>(null);
  const acknowledgedRoadmapRef = useRef<string | null>(null);
  const openedNodeRef = useRef<string | null>(null);
  const { acknowledge, retry } = useNotificationAcknowledgement();
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
  const closeEditorAfterNodeDeletion = useCallback(() => {
    dispatchCanvas({ type: 'closeSelectedNode', panel: 'editor' });
    requestNodeFocusReturn();
  }, [requestNodeFocusReturn]);
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
    addNode,
    updateNode,
    moveNode,
    dependencyWorkflow,
    teacherBlockWorkflow,
    nodeVisibilityWorkflow,
    nodeDeletionWorkflow,
    addResource,
    uploadResource,
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
    simulationRoadmap,
    canvasPreviewWorkflow,
  } = useRoadmapCanvasSession(input, {
    guardDraft: guardEditorDraft,
    closeEditor: closeEditorAfterNodeDeletion,
    canvasPreview: {
      currentView: { selectedNodeId, isEditorOpen, isStudentDetailOpen },
      onEnter: prepareCanvasPreview,
      onExit: restoreCanvasPreview,
    },
  });
  const feedback = useRoadmapCanvasFeedback();
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
    experience: input.experience,
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
  useEffect(() => {
    if (!input.notificationsEnabled || !roadmap || isCanvasPreview) return;
    const roadmapId = roadmap.roadmap.id;
    if (acknowledgedRoadmapRef.current === roadmapId) return;
    acknowledgedRoadmapRef.current = roadmapId;
    const operation = { roadmapId, accessibleNodeIds, openingId: input.notificationOpeningId };
    acknowledgementInputRef.current = operation;
    void acknowledge(operation).then((success) => setAcknowledgementError(!success));
  }, [
    acknowledge,
    accessibleNodeIds,
    input.notificationsEnabled,
    input.notificationOpeningId,
    isCanvasPreview,
    roadmap,
  ]);
  const deepLinkHandledRef = useRef<string | null>(null);
  useEffect(() => {
    const nodeId = input.targetNodeId;
    if (!nodeId || !roadmap || deepLinkHandledRef.current === nodeId) return;
    deepLinkHandledRef.current = nodeId;
    if (!accessibleNodeIds.has(nodeId)) {
      setSyncedSelectionNotice(
        'Este Nodo ya no está disponible. Puedes revisar el Roadmap actualizado.',
      );
      return;
    }
    dispatchCanvas({
      type: 'selectNode',
      nodeId,
      panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
    });
  }, [accessibleNodeIds, canEditRoadmap, input.targetNodeId, isStudentExperience, roadmap]);
  useEffect(() => {
    if (!input.notificationsEnabled || !roadmap || isCanvasPreview) return;
    const isNodeOpen = isStudentExperience ? isStudentDetailOpen : isEditorOpen;
    if (!isNodeOpen || !selectedNodeId) {
      openedNodeRef.current = null;
      return;
    }
    const node = roadmap.nodes.find((candidate) => candidate.id === selectedNodeId);
    const openKey = `${roadmap.roadmap.id}:${selectedNodeId}`;
    if (!node || !accessibleNodeIds.has(node.id) || openedNodeRef.current === openKey) return;
    openedNodeRef.current = openKey;
    const operation = { roadmapId: roadmap.roadmap.id, nodeId: node.id };
    acknowledgementInputRef.current = operation;
    void acknowledge(operation).then((success) => setAcknowledgementError(!success));
  }, [
    acknowledge,
    accessibleNodeIds,
    input.notificationsEnabled,
    isCanvasPreview,
    isEditorOpen,
    isStudentDetailOpen,
    isStudentExperience,
    roadmap,
    selectedNodeId,
  ]);
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

  return {
    title,
    courseCode,
    year,
    semester,
    dispatchCanvas,
    focusReturnRequest,
    syncedSelectionNotice,
    setSyncedSelectionNotice,
    acknowledgementError,
    setAcknowledgementError,
    acknowledgementInputRef,
    retry,
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
    addNode,
    dependencyWorkflow,
    teacherBlockWorkflow,
    nodeVisibilityWorkflow,
    nodeDeletionWorkflow,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
    canvasPreviewWorkflow,
    feedback,
    exclusiveConfirmation,
    automaticLayout,
    setAutomaticLayout,
    confirmedAutomaticLayout,
    nodeTypeDeletion,
    setNodeTypeDeletion,
    requestExclusiveConfirmation,
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
    confirmAutomaticLayout,
    requestNodeTypeDeletion,
    confirmNodeTypeDeletion,
    handleNodeEditorIntent,
    graphProjection,
  };
}

export function RoadmapCanvasView({ input }: Props) {
  const model = useRoadmapCanvasController({ input });
  const {
    dispatchCanvas,
    syncedSelectionNotice,
    setSyncedSelectionNotice,
    acknowledgementError,
    setAcknowledgementError,
    acknowledgementInputRef,
    retry,
    canvasFocusRef,
    selectedNodeId,
    roadmap,
    error,
    retryRefresh,
    accessLost,
    addNode,
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
        className={cn(
          'relative box-border grid min-h-[calc(100dvh-4rem)] min-w-0 flex-1 overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26/5%)] lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
          isSidePanelOpen ? 'lg:grid-cols-[minmax(0,1fr)_var(--sidebar-width)]' : 'lg:grid-cols-1',
        )}
      >
        {acknowledgementError ? (
          <div
            className="absolute top-2 left-1/2 z-30 flex -translate-x-1/2 items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm shadow"
            role="status"
          >
            No se pudieron reconocer algunos avisos.
            <button
              className="font-semibold underline"
              onClick={() => {
                const operation = acknowledgementInputRef.current;
                if (!operation) return;
                void retry(operation).then((success) => setAcknowledgementError(!success));
              }}
              type="button"
            >
              Reintentar
            </button>
          </div>
        ) : null}
        <div
          ref={canvasFocusRef}
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[min(540px,calc(100dvh-4rem-2px))] bg-background lg:min-h-0"
        >
          <RoadmapCanvasGraph
            model={model}
            input={input}
            selectedNode={selectedNode}
            addNodeAtOpenPosition={addNodeAtOpenPosition}
            roadmap={roadmap}
            displayedRoadmap={displayedRoadmap}
            graphProjection={graphProjection}
          />
          <RoadmapCanvasFeedback />
          {error ? (
            <Button className="absolute right-5 bottom-20" type="button" onClick={retryRefresh}>
              Reintentar actualización
            </Button>
          ) : null}
          {syncedSelectionNotice ? (
            <Alert
              role="status"
              className="absolute bottom-5 left-5 z-5 w-[min(23rem,calc(100%-2.5rem))] bg-card shadow-sm"
            >
              <AlertDescription>{syncedSelectionNotice}</AlertDescription>
              <AlertAction>
                <Button
                  aria-label="Cerrar aviso de actualización"
                  onClick={() => setSyncedSelectionNotice(null)}
                  size="icon-sm"
                  type="button"
                  variant="ghost"
                >
                  <X aria-hidden="true" />
                </Button>
              </AlertAction>
            </Alert>
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
    exclusiveConfirmation,
    automaticLayout,
    setAutomaticLayout,
    confirmAutomaticLayout,
    nodeTypeDeletion,
    setNodeTypeDeletion,
    confirmNodeTypeDeletion,
    nodeDeletionWorkflow,
    canvasPreviewWorkflow,
    dependencyWorkflow,
    nodeVisibilityWorkflow,
    teacherBlockWorkflow,
  } = model;
  switch (exclusiveConfirmation) {
    case 'automatic-layout':
      return (
        <ConfirmationDialog
          confirmation={automaticLayout ? roadmapAutoLayoutConfirmation : null}
          pendingActionId={
            automaticLayout?.isPending ? roadmapConfirmationActionIds.autoLayout : undefined
          }
          onCancel={() => setAutomaticLayout(null)}
          onAction={(actionId) => void confirmAutomaticLayout(actionId)}
        />
      );
    case 'node-type-deletion':
      return (
        <ConfirmationDialog
          confirmation={
            nodeTypeDeletion ? nodeTypeDeletionConfirmation(nodeTypeDeletion.nodeType) : null
          }
          pendingActionId={
            nodeTypeDeletion?.isPending ? roadmapConfirmationActionIds.deleteNodeType : undefined
          }
          onCancel={() => {
            if (!nodeTypeDeletion?.isPending) setNodeTypeDeletion(null);
          }}
          onAction={(actionId) => void confirmNodeTypeDeletion(actionId)}
        />
      );
    case 'node-deletion':
      return <ConfirmationDialog {...nodeDeletionWorkflow.confirmationDialog} />;
    case 'canvas-preview':
      return <ConfirmationDialog {...canvasPreviewWorkflow.confirmationDialog} />;
    case 'dependency-deletion':
      return <ConfirmationDialog {...dependencyWorkflow.deletionDialog} />;
    case 'node-visibility':
      return <ConfirmationDialog {...nodeVisibilityWorkflow.confirmationDialog} />;
    case 'dependency-creation':
      return <ConfirmationDialog {...dependencyWorkflow.creationDialog} />;
    case 'teacher-block':
      return <ConfirmationDialog {...teacherBlockWorkflow.confirmationDialog} />;
    default:
      return (
        <ConfirmationDialog
          confirmation={null}
          onCancel={() => undefined}
          onAction={() => undefined}
        />
      );
  }
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
    nodeVisibilityWorkflow,
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
    completeNode,
    feedback,
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
  selectedNode,
  addNodeAtOpenPosition,
  roadmap,
  displayedRoadmap,
  graphProjection,
}: {
  model: ReturnType<typeof useRoadmapCanvasController>;
  input: Props['input'];
  selectedNode: RoadmapDto['nodes'][number] | StudentRoadmapDto['nodes'][number] | undefined;
  addNodeAtOpenPosition: (
    node: Parameters<ReturnType<typeof useRoadmapCanvasController>['addNode']>[0],
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
    setSyncedSelectionNotice,
    selectedNodeId,
    isEditorOpen,
    guardEditorDraft,
    addNodeType,
    updateNodeType,
    canvasPreviewWorkflow,
    confirmedAutomaticLayout,
    requestExclusiveConfirmation,
    canvasMode,
    isHistoricalRoadmap,
    isCanvasPreview,
    isStudentExperience,
    canEditRoadmap,
    canPreviewCanvas,
    canEnterCanvasPreview,
    canResetCanvasPreview,
    closeSelectedNode,
    requestNodeTypeDeletion,
  } = model;
  return (
    <RoadmapGraph
      projection={graphProjection}
      notificationsEnabled={Boolean(input.notificationsEnabled)}
      onSelectNode={(nodeId) => {
        const node = displayedRoadmap.nodes.find((candidate) => candidate.id === nodeId);
        if (isStudentExperience && isStudentBlockedNode(node)) return;
        const select = () => {
          setSyncedSelectionNotice(null);
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
      onViewportChange={canvasPreviewWorkflow.onViewportChange}
      viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
      confirmedAutomaticLayout={confirmedAutomaticLayout}
      topRightActions={
        !isCanvasPreview && (canEditRoadmap || canPreviewCanvas)
          ? () => (
              <>
                {canEnterCanvasPreview ? (
                  <Button
                    ref={canvasPreviewWorkflow.entryButtonRef}
                    aria-label="Vista estudiante"
                    title="Vista estudiante"
                    type="button"
                    variant="outline"
                    onClick={canvasPreviewWorkflow.requestEntry}
                  >
                    <Eye data-icon="inline-start" />
                    Vista estudiante
                  </Button>
                ) : null}
                {canEditRoadmap && selectedNode ? (
                  <Button
                    aria-label={
                      isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'
                    }
                    title={isEditorOpen ? 'Ocultar panel de edición' : 'Mostrar panel de edición'}
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
      bottomRightActions={
        !isCanvasPreview && canEditRoadmap
          ? (findOpenPosition) => (
              <NodeCreator
                nodeTypes={roadmap.nodeTypes}
                onSubmit={(node) => addNodeAtOpenPosition(node, findOpenPosition)}
                onCreateNodeType={addNodeType}
                onUpdateNodeType={updateNodeType}
                onRequestDeleteNodeType={requestNodeTypeDeletion}
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
            notificationsEnabled={Boolean(input.notificationsEnabled)}
            roadmapId={roadmap.roadmap.id}
          />
        ),
        topCenter: isCanvasPreview ? (
          <CanvasPreviewToolbar
            canReset={canResetCanvasPreview}
            isHistorical={isHistoricalRoadmap}
            onRequestReset={() =>
              requestExclusiveConfirmation('canvas-preview', canvasPreviewWorkflow.requestReset)
            }
            onExit={canvasPreviewWorkflow.exit}
          />
        ) : null,
      }}
    />
  );
}

function RoadmapCanvasHeader({
  title,
  courseCode,
  year,
  semester,
  isCanvasPreview,
  isEditing,
  notificationsEnabled,
  roadmapId,
}: Pick<
  ReturnType<typeof useRoadmapCanvasController>,
  'title' | 'courseCode' | 'year' | 'semester' | 'isCanvasPreview'
> & { isEditing: boolean; notificationsEnabled: boolean; roadmapId: string }) {
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
      {!isCanvasPreview ? (
        <div className="mt-2">
          <NotificationCountButton
            enabled={notificationsEnabled}
            filter={{ roadmapId: roadmapId }}
            label="este Roadmap"
          />
        </div>
      ) : null}
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
  );
}
