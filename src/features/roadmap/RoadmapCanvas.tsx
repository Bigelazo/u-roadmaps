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
import { useDependencyWorkflow } from '@/features/roadmap/canvas/dependency-workflow';
import { useEditorDraftGuard } from '@/features/roadmap/canvas/editor-draft-guard';
import {
  useNodeDeletionWorkflow,
  type NodeDeletionRequestOptions,
} from '@/features/roadmap/canvas/node-deletion-workflow';
import { useNodeVisibilityWorkflow } from '@/features/roadmap/canvas/node-visibility-workflow';
import { useTeacherBlockWorkflow } from '@/features/roadmap/canvas/teacher-block-workflow';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import {
  RoadmapGraph,
  type RoadmapGraphEditing,
  type RoadmapGraphEditingIntent,
  type RoadmapGraphProjection,
} from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import { useRoadmap } from '@/features/roadmap/useRoadmap';
import type {
  CourseOfferingIdentifier,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import type {
  EditorDraftDiscardDestination,
  RoadmapEditorDraftHandle,
} from '@/features/roadmap/editor/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
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
  const [focusReturnRequest, setFocusReturnRequest] = useState<string | null>(null);
  const {
    selectedNodeId,
    isEditorOpen,
    isStudentDetailOpen,
    editorKey,
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    resourceComposerRequest,
  } = canvasState;
  const [successToast, setSuccessToast] = useState<{ id: number; message: string } | null>(null);
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);
  const editorDraftRef = useRef<RoadmapEditorDraftHandle>(null);
  const nodeDeletionRequestRef = useRef<
    (nodeId: string, options?: NodeDeletionRequestOptions) => void
  >(() => {});
  const canvasPreviewDraftResumeRef = useRef<() => void>(() => {});
  const successToastIdRef = useRef(0);
  const focusReturnRequestIdRef = useRef(0);
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
  } = useRoadmap(identifier, canEdit || canPreview ? 'teaching' : 'student');
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
  const nodeVisibilityWorkflow = useNodeVisibilityWorkflow({
    roadmap,
    previewNodeVisibility,
    toggleVisibility,
  });
  const dismissSuccessToast = useCallback(() => setSuccessToast(null), []);

  const showSuccessToast = useCallback((message: string) => {
    setSuccessToast({ id: ++successToastIdRef.current, message });
  }, []);

  const requestNodeFocusReturn = useCallback(() => {
    setFocusReturnRequest(`node-surface-close-${++focusReturnRequestIdRef.current}`);
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

  const resumeEditorDraftDestination = useCallback((destination: EditorDraftDiscardDestination) => {
    switch (destination.kind) {
      case 'discardNodeDraft':
        nodeDeletionRequestRef.current(destination.nodeId, { draftWasDiscarded: true });
        return;
      case 'discardResourceDraft':
        dispatchCanvas({ type: 'openResourceComposer', nodeId: destination.nodeId });
        return;
      case 'discardCanvasPreviewDraft':
        canvasPreviewDraftResumeRef.current();
        return;
    }
  }, []);

  const editorDraftGuard = useEditorDraftGuard({
    draftRef: editorDraftRef,
    onDiscard: resumeEditorDraftDestination,
  });
  const requestEditorDraft = editorDraftGuard.request;

  const requestEditorDraftDiscard = useCallback(
    (nodeId: string) => requestEditorDraft({ kind: 'discardNodeDraft', nodeId }),
    [requestEditorDraft],
  );

  const closeEditorAfterNodeDeletion = useCallback(() => {
    dispatchCanvas({ type: 'closeSelectedNode', panel: 'editor' });
    requestNodeFocusReturn();
  }, [requestNodeFocusReturn]);

  const nodeDeletionWorkflow = useNodeDeletionWorkflow({
    previewNodeDeletion,
    deleteNode,
    requestEditorDraftDiscard,
    editorDraftRef,
    closeEditor: closeEditorAfterNodeDeletion,
  });
  nodeDeletionRequestRef.current = nodeDeletionWorkflow.requestDeletion;

  const requestCanvasPreviewDraftDiscard = useCallback(
    () => requestEditorDraft({ kind: 'discardCanvasPreviewDraft' }),
    [requestEditorDraft],
  );

  const prepareCanvasPreview = useCallback((discardDraft: boolean) => {
    dispatchCanvas({ type: 'prepareCanvasPreview', discardDraft });
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
    requestDraftDiscard: requestCanvasPreviewDraftDiscard,
    loadSimulation,
    completeSimulatedNode,
    resetSimulation,
    onEnter: prepareCanvasPreview,
    onExit: restoreCanvasPreview,
  });
  canvasPreviewDraftResumeRef.current = canvasPreviewWorkflow.resumeEntryAfterDraftDiscard;

  const canvasMode = deriveCanvasMode({
    canEdit,
    canPreview,
    isHistorical,
    isCanvasPreview: canvasPreviewWorkflow.isActive,
  });
  const { isHistorical: isHistoricalRoadmap, isCanvasPreview, isStudentExperience } = canvasMode;
  const { canEditRoadmap, canPreviewCanvas, canEnterCanvasPreview, canResetCanvasPreview } =
    canvasMode.capabilities;

  function closeSelectedNode() {
    dispatchCanvas({
      type: 'closeSelectedNode',
      panel: canEditRoadmap ? 'editor' : 'student',
    });
    requestNodeFocusReturn();
  }

  function closeTeacherPreview() {
    dispatchCanvas({ type: 'closeTeacherPreview' });
    requestAnimationFrame(() => previewButtonRef.current?.focus());
  }

  const openResourceComposer = useCallback(
    (nodeId: string) => {
      if (!canEditRoadmap || isCanvasPreview) return;
      if (requestEditorDraft({ kind: 'discardResourceDraft', nodeId })) return;
      dispatchCanvas({ type: 'openResourceComposer', nodeId });
    },
    [canEditRoadmap, isCanvasPreview, requestEditorDraft],
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
  }, [canEditRoadmap, isCanvasPreview, isEditorOpen, selectedNodeId, teacherPreviewNode]);

  const displayedRoadmap = isCanvasPreview ? simulationRoadmap : roadmap;
  const requestDependencyCreation = dependencyWorkflow.requestCreation;
  const requestDependencyDeletion = dependencyWorkflow.requestDeletion;
  const requestNodeDeletion = nodeDeletionWorkflow.requestDeletion;
  const requestTeacherBlockChange = teacherBlockWorkflow.requestChange;
  const requestVisibilityChange = nodeVisibilityWorkflow.requestChange;
  const handleGraphEditingIntent = useCallback(
    (intent: RoadmapGraphEditingIntent) => {
      switch (intent.kind) {
        case 'node-positions':
          void Promise.all(
            intent.positions.map(({ nodeId, position }) => moveNode(nodeId, position)),
          );
          return;
        case 'create-dependency':
          requestDependencyCreation(intent);
          return;
        case 'delete-dependencies':
          requestDependencyDeletion([...intent.dependencyIds]);
          return;
        case 'change-teacher-block':
          requestTeacherBlockChange(intent.nodeId, intent.operation);
          return;
        case 'change-visibility':
          void requestVisibilityChange(intent.nodeId, !intent.isVisible);
          return;
        case 'add-resource':
          openResourceComposer(intent.nodeId);
          return;
        case 'delete-node':
          requestNodeDeletion(intent.nodeId);
          return;
      }
    },
    [
      moveNode,
      openResourceComposer,
      requestDependencyCreation,
      requestDependencyDeletion,
      requestNodeDeletion,
      requestTeacherBlockChange,
      requestVisibilityChange,
    ],
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
              dispatchCanvas({
                type: 'selectNode',
                nodeId,
                panel: isStudentExperience ? 'student' : canEditRoadmap ? 'editor' : 'none',
              });
            }}
            selectedNodeId={selectedNodeId}
            focusReturnRequest={focusReturnRequest}
            onClearSelectedNode={closeSelectedNode}
            onViewportChange={canvasPreviewWorkflow.onViewportChange}
            viewportRestoration={canvasPreviewWorkflow.viewportRestoration}
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
                          onDeleteNodeType={deleteNodeType}
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
                  onRequestReset={canvasPreviewWorkflow.requestReset}
                  onExit={canvasPreviewWorkflow.exit}
                />
              ) : null,
              bottomRight: (
                <>
                  {error ? <RoadmapErrorToast message={error} onDismiss={dismissError} /> : null}
                  {successToast ? (
                    <RoadmapSuccessToast
                      key={successToast.id}
                      message={successToast.message}
                      onDismiss={dismissSuccessToast}
                    />
                  ) : null}
                  <KeyboardShortcuts
                    key="roadmap-keyboard-shortcuts"
                    isEditing={canvasMode.isEditing}
                  />
                </>
              ),
            }}
          />
        </div>
        {canEditRoadmap && (
          <RoadmapEditor
            key={editorKey + ':' + (selectedNode?.id ?? 'none')}
            roadmap={roadmap as RoadmapDto}
            selectedNode={selectedNode as RoadmapNode | undefined}
            ref={editorDraftRef}
            isVisibilityPending={nodeVisibilityWorkflow.isPending}
            isOpen={canvasMode.isEditing && isEditorOpen}
            resourceComposerRequest={resourceComposerRequest}
            onClose={closeSelectedNode}
            onUpdateNode={updateNodeWithConfirmation}
            onToggleVisibility={nodeVisibilityWorkflow.requestChange}
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
              if (canvasPreviewWorkflow.completeNode(node.id)) return;
              if (teacherPreviewNode) dispatchCanvas({ type: 'completeTeacherPreview' });
              else void completeNode(node.id);
            }}
            isReadOnly={isHistoricalRoadmap && !teacherPreviewNode}
            nodeTypes={roadmap.nodeTypes}
            panelWidth={teacherPreviewNode ? editorPanel.width : studentPanel.width}
            onPanelWidthChange={teacherPreviewNode ? editorPanel.setWidth : studentPanel.setWidth}
          />
        )}
      </section>
      <ConfirmationDialog {...nodeDeletionWorkflow.confirmationDialog} />
      <ConfirmationDialog {...canvasPreviewWorkflow.confirmationDialog} />
      <ConfirmationDialog {...editorDraftGuard.confirmationDialog} />
      <ConfirmationDialog {...dependencyWorkflow.deletionDialog} />
      <ConfirmationDialog {...nodeVisibilityWorkflow.confirmationDialog} />
      <ConfirmationDialog {...dependencyWorkflow.creationDialog} />
      <ConfirmationDialog {...teacherBlockWorkflow.confirmationDialog} />
    </SidebarProvider>
  );
}
