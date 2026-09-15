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
import { useNodeDeletionWorkflow } from '@/features/roadmap/canvas/node-deletion-workflow';
import { useNodeVisibilityWorkflow } from '@/features/roadmap/canvas/node-visibility-workflow';
import { useTeacherBlockWorkflow } from '@/features/roadmap/canvas/teacher-block-workflow';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
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
import { useRoadmap } from '@/features/roadmap/useRoadmap';
import type {
  CourseOfferingIdentifier,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapDto,
  StudentRoadmapNode,
} from '@/features/roadmap/types';
import { Alert, AlertDescription, AlertTitle } from '@/shared/ui/alert';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/shared/ui/empty';
import { Spinner } from '@/shared/ui/spinner';
import { Badge } from '@/shared/ui/badge';
import { Button } from '@/shared/ui/button';
import { SidebarProvider } from '@/shared/ui/sidebar';
import { cn } from 'cn';

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
    teacherPreviewNode,
    isTeacherPreviewCompleted,
    resourceComposerCommand,
    teacherPreviewFocusReturn,
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
  const nodeEditorRef = useRef<NodeEditorHandle>(null);
  const resourceCommandIdRef = useRef(0);
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
          break;
        case 'update-resource':
          succeeded = await updateResourceWithConfirmation(effect.resourceId, effect.resource);
          break;
        case 'delete-resource':
          succeeded = await deleteResource(effect.resourceId);
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
            id: `open-resource-${++resourceCommandIdRef.current}`,
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
  const requestDependencyCreation = dependencyWorkflow.requestCreation;
  const requestDependencyDeletion = dependencyWorkflow.requestDeletion;
  const requestNodeDeletion = nodeDeletionWorkflow.requestDeletion;
  const requestTeacherBlockChange = teacherBlockWorkflow.requestChange;
  const requestVisibilityChange = nodeVisibilityWorkflow.requestChange;
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
        case 'change-visibility':
          void requestVisibilityChange(intent.nodeId, intent.isVisible);
          return;
        case 'change-teacher-block':
          requestTeacherBlockChange(intent.nodeId, intent.operation);
          return;
        case 'delete-node':
          requestNodeDeletion(intent.nodeId, { draftWasDiscarded: true });
          return;
      }
    },
    [closeSelectedNodeNow, requestNodeDeletion, requestTeacherBlockChange, requestVisibilityChange],
  );
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
          <NodeEditorPanel
            isOpen={canvasMode.isEditing && isEditorOpen}
            panelWidth={editorPanel.width}
            onPanelWidthChange={editorPanel.setWidth}
          >
            <NodeEditor
              ref={nodeEditorRef}
              node={selectedNode as RoadmapNode | undefined}
              nodeTypes={roadmap.nodeTypes}
              isVisibilityPending={nodeVisibilityWorkflow.isPending}
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
      <ConfirmationDialog {...dependencyWorkflow.deletionDialog} />
      <ConfirmationDialog {...nodeVisibilityWorkflow.confirmationDialog} />
      <ConfirmationDialog {...dependencyWorkflow.creationDialog} />
      <ConfirmationDialog {...teacherBlockWorkflow.confirmationDialog} />
    </SidebarProvider>
  );
}
