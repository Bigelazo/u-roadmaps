'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import dynamic from 'next/dynamic';
import { ArrowRight, CircleAlert, EyeOff, Keyboard, PanelRightOpen, Trash2 } from 'lucide-react';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { RoadmapSuccessToast } from '@/features/roadmap/RoadmapSuccessToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
import { usePersistentPanelWidth } from '@/features/roadmap/ui/ResizablePanel';
import {
  useRoadmap,
  type StructuralDependency,
  type TeacherBlockImpact,
} from '@/features/roadmap/useRoadmap';
import type {
  CourseOfferingIdentifier,
  RoadmapDto,
  RoadmapNode,
  StudentRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
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
  nodes: TeacherBlockImpact[];
};

function KeyboardShortcut({ keys, children }: { keys: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] items-start gap-3">
      <dt className="flex min-h-5 min-w-0 items-center">{keys}</dt>
      <dd className="pt-px leading-relaxed">{children}</dd>
    </div>
  );
}

function teacherBlockConfirmation(operation: TeacherBlockOperation, count: number) {
  const nodes = count === 1 ? 'nodo' : 'nodos';
  if (operation === 'BLOCK') {
    return {
      title: 'Confirmar bloqueo docente',
      description: `Bloquearás ${count} ${nodes}.`,
      action: 'Bloquear acceso',
    };
  }
  if (operation === 'UNBLOCK') {
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

function sameTeacherBlockImpact(first: TeacherBlockImpact[], second: TeacherBlockImpact[]) {
  return (
    first.length === second.length &&
    first.every(
      (node, index) => node.id === second[index]?.id && node.title === second[index]?.title,
    )
  );
}

export default function RoadmapCanvas({
  identifier,
  canEdit = false,
  title,
  courseCode,
  year,
  semester,
}: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [isStudentDetailOpen, setIsStudentDetailOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<{ id: number; message: string } | null>(null);
  const editorPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:roadmap-editor-panel-width',
    initialWidth: 360,
  });
  const studentPanel = usePersistentPanelWidth({
    storageKey: 'u-roadmaps:student-node-detail-width',
    initialWidth: 426,
  });
  const [pendingDependencyIds, setPendingDependencyIds] = useState<string[] | null>(null);
  const [pendingVisibilityChange, setPendingVisibilityChange] =
    useState<PendingVisibilityChange | null>(null);
  const [pendingDependencyChange, setPendingDependencyChange] =
    useState<PendingDependencyChange | null>(null);
  const [pendingTeacherBlockChange, setPendingTeacherBlockChange] =
    useState<PendingTeacherBlockChange | null>(null);
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
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
    deleteNode,
    addResource,
    uploadResource,
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
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
    setSelectedNodeId(null);
    if (canEdit) setIsEditorOpen(false);
    else setIsStudentDetailOpen(false);
    requestAnimationFrame(() => selectedNodeTriggerRef.current?.focus());
  }

  useEffect(() => {
    const handleKeyboardShortcut = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && canEdit && isEditorOpen) {
        event.preventDefault();
        setIsEditorOpen(false);
        return;
      }
      if (event.key.toLowerCase() === 'b' && (event.metaKey || event.ctrlKey) && selectedNodeId) {
        event.preventDefault();
        if (canEdit) setIsEditorOpen((open) => !open);
        else setIsStudentDetailOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyboardShortcut);
    return () => window.removeEventListener('keydown', handleKeyboardShortcut);
  }, [canEdit, isEditorOpen, selectedNodeId]);

  async function requestVisibilityChange(nodeId: string, isVisible: boolean) {
    if (!isVisible) return toggleVisibility(nodeId, isVisible);
    const dependencies = await previewNodeVisibility(nodeId);
    if (dependencies) setPendingVisibilityChange({ nodeId, isVisible, dependencies });
    return false;
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
    setPendingDependencyChange({
      sourceNodeId: source,
      targetNodeId: target,
      sourceHandle: sourceHandle ?? undefined,
      targetHandle: targetHandle ?? undefined,
      nodes,
    });
  }

  async function requestTeacherBlockChange(nodeId: string, operation: TeacherBlockOperation) {
    const nodes = await previewTeacherBlock(nodeId, operation);
    if (nodes) setPendingTeacherBlockChange({ nodeId, operation, nodes });
  }

  async function confirmTeacherBlockChange() {
    if (!pendingTeacherBlockChange) return;
    const latestNodes = await previewTeacherBlock(
      pendingTeacherBlockChange.nodeId,
      pendingTeacherBlockChange.operation,
    );
    if (!latestNodes) {
      setPendingTeacherBlockChange(null);
      return;
    }
    if (!sameTeacherBlockImpact(pendingTeacherBlockChange.nodes, latestNodes)) {
      setPendingTeacherBlockChange({ ...pendingTeacherBlockChange, nodes: latestNodes });
      return;
    }
    setPendingTeacherBlockChange(null);
    await changeTeacherBlock(pendingTeacherBlockChange.nodeId, pendingTeacherBlockChange.operation);
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

  const selectedNode = roadmap.nodes.find((node) => node.id === selectedNodeId);
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
    return addNode(node, position, setSelectedNodeId);
  };
  const teacherBlockDialog = pendingTeacherBlockChange
    ? teacherBlockConfirmation(
        pendingTeacherBlockChange.operation,
        pendingTeacherBlockChange.nodes.length,
      )
    : null;
  const visibilityDependencies = pendingVisibilityChange?.dependencies ?? [];
  const hasVisibilityDependencies = visibilityDependencies.length > 0;
  return (
    <SidebarProvider
      className="min-h-0 lg:h-full"
      style={
        {
          '--sidebar-width': `${canEdit ? editorPanel.width : studentPanel.width}px`,
        } as CSSProperties
      }
    >
      <section
        className={cn(
          'relative box-border grid min-h-[calc(100dvh-4rem)] min-w-0 flex-1 overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26_/_5%)] lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
          canEdit && isEditorOpen
            ? 'lg:grid-cols-[minmax(0,1fr)_var(--sidebar-width)]'
            : 'lg:grid-cols-1',
        )}
      >
        <div
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[min(540px,calc(100dvh-4rem-2px))] bg-background lg:min-h-0"
        >
          <header className="pointer-events-none absolute top-4 left-4 z-[4] max-w-[calc(100%-2rem)] sm:top-6 sm:left-6 sm:max-w-md">
            <div className="flex flex-wrap items-center gap-2">
              {canEdit ? <Badge variant="secondary">Modo edición</Badge> : null}
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
          <details
            aria-label="Atajos de teclado"
            className="group pointer-events-auto absolute right-5 bottom-[18px] z-[4] w-[min(23rem,calc(100%-2.5rem))] overflow-hidden rounded-xl border border-border bg-card/95 text-xs text-muted-foreground shadow-lg shadow-black/5 backdrop-blur-sm"
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
            <dl className="grid gap-3 border-t border-border px-3.5 py-3.5">
              <KeyboardShortcut keys={<Kbd aria-label="Tabulador">⇥</Kbd>}>
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
              <KeyboardShortcut
                keys={
                  <KbdGroup className="flex-wrap">
                    <Kbd aria-label="Flecha arriba">↑</Kbd>
                    <Kbd aria-label="Flecha abajo">↓</Kbd>
                    <Kbd aria-label="Flecha izquierda">←</Kbd>
                    <Kbd aria-label="Flecha derecha">→</Kbd>
                  </KbdGroup>
                }
              >
                Mover el nodo seleccionado en modo edición; con <Kbd aria-label="Shift">⇧</Kbd>, más
                rápido.
              </KeyboardShortcut>
              {canEdit ? (
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
                  <KbdGroup className="flex-wrap">
                    <Kbd aria-label="Comando">⌘</Kbd>
                    <span aria-hidden="true">+</span>
                    <Kbd>B</Kbd>
                    <span aria-hidden="true">/</span>
                    <Kbd aria-label="Control">⌃</Kbd>
                    <span aria-hidden="true">+</span>
                    <Kbd>B</Kbd>
                  </KbdGroup>
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
                Con el borde del panel enfocado, usar su ancho mínimo o máximo.
              </KeyboardShortcut>
            </dl>
          </details>
          {error && <RoadmapErrorToast message={error} onDismiss={dismissError} />}
          {successToast && (
            <RoadmapSuccessToast
              key={successToast.id}
              message={successToast.message}
              onDismiss={dismissSuccessToast}
            />
          )}
          <RoadmapGraph
            roadmap={roadmap}
            canEdit={canEdit}
            onSelectNode={(nodeId, trigger) => {
              const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
              if (!canEdit && isStudentBlockedNode(node)) return;
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
              if (canEdit) setIsEditorOpen(true);
              else setIsStudentDetailOpen(true);
            }}
            selectedNodeId={selectedNodeId}
            onMoveNode={(_event, node) => void moveNode(node.id, snapToRoadmapGrid(node.position))}
            onKeyboardNodeMove={(nodeId, position) =>
              void moveNode(nodeId, snapToRoadmapGrid(position))
            }
            onClearSelectedNode={closeSelectedNode}
            onConnectNodes={(connection) => void requestDependencyChange(connection)}
            onDeleteDependencies={setPendingDependencyIds}
            onAutoLayout={(nodes) => {
              void Promise.all(
                nodes.map((node) => moveNode(node.id, snapToRoadmapGrid(node.position))),
              );
            }}
            topRightActions={
              canEdit
                ? (getViewport) => (
                    <>
                      <NodeCreator
                        nodeTypes={roadmap.nodeTypes}
                        onSubmit={(node) => addNodeAtViewport(node, getViewport())}
                        onCreateNodeType={addNodeType}
                        onUpdateNodeType={updateNodeType}
                        onDeleteNodeType={deleteNodeType}
                      />
                      {selectedNode && !isEditorOpen ? (
                        <Button
                          aria-label="Mostrar panel de edición"
                          title="Mostrar panel de edición"
                          type="button"
                          size="icon"
                          variant="outline"
                          onClick={() => setIsEditorOpen(true)}
                        >
                          <PanelRightOpen />
                        </Button>
                      ) : null}
                    </>
                  )
                : undefined
            }
          />
        </div>
        {canEdit && (
          <RoadmapEditor
            roadmap={roadmap as RoadmapDto}
            selectedNode={selectedNode as RoadmapNode | undefined}
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen((isOpen) => !isOpen)}
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
            panelWidth={editorPanel.width}
            onPanelWidthChange={editorPanel.setWidth}
          />
        )}
        {!canEdit && (
          <StudentNodeDetail
            node={
              isStudentDetailOpen ? (selectedNode as StudentRoadmapNode | undefined) : undefined
            }
            status={isStudentDetailOpen && selectedNode ? studentNodeStatus(selectedNode) : null}
            onClose={closeSelectedNode}
            onComplete={(node) => void completeNode(node.id)}
            panelWidth={studentPanel.width}
            onPanelWidthChange={studentPanel.setWidth}
          />
        )}
      </section>
      <AlertDialog
        open={Boolean(pendingDependencyIds?.length)}
        onOpenChange={(open) => !open && setPendingDependencyIds(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás{' '}
              {pendingDependencyIds?.length === 1 ? 'esta dependencia' : 'estas dependencias'}. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                for (const dependencyId of pendingDependencyIds ?? [])
                  void deleteDependency(dependencyId);
                setPendingDependencyIds(null);
              }}
            >
              <Trash2 data-icon="inline-start" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingVisibilityChange)}
        onOpenChange={(open) => !open && setPendingVisibilityChange(null)}
      >
        <AlertDialogContent className="gap-5 sm:max-w-xl">
          <AlertDialogHeader className="items-stretch gap-4 text-left sm:items-stretch">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground ring-1 ring-border"
              >
                <EyeOff className="size-5 text-muted-foreground" />
              </span>
              <div className="min-w-0 space-y-1">
                <AlertDialogTitle className="text-xl font-semibold tracking-[-0.025em]">
                  Confirmar ocultación
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm leading-relaxed">
                  {hasVisibilityDependencies ? (
                    <>
                      Ocultarás este nodo y eliminarás{' '}
                      <span className="font-semibold text-destructive">
                        {visibilityDependencies.length}{' '}
                        {visibilityDependencies.length === 1
                          ? 'dependencia relacionada'
                          : 'dependencias relacionadas'}
                      </span>
                      .
                    </>
                  ) : (
                    'Ocultarás este nodo. No posee dependencias.'
                  )}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>
          {hasVisibilityDependencies ? (
            <section aria-labelledby="removed-dependencies-heading" className="space-y-2.5">
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
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() => {
                if (pendingVisibilityChange)
                  void toggleVisibility(
                    pendingVisibilityChange.nodeId,
                    pendingVisibilityChange.isVisible,
                  );
                setPendingVisibilityChange(null);
              }}
            >
              Ocultar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingDependencyChange)}
        onOpenChange={(open) => !open && setPendingDependencyChange(null)}
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
                setPendingDependencyChange(null);
              }}
            >
              Conectar y bloquear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={Boolean(pendingTeacherBlockChange)}
        onOpenChange={(open) => !open && setPendingTeacherBlockChange(null)}
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
                <li key={node.id}>{node.title}</li>
              ))}
            </ul>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction type="button" onClick={() => void confirmTeacherBlockChange()}>
              {teacherBlockDialog?.action}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}
