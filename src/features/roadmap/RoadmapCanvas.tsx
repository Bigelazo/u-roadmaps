'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Circle, CircleAlert, LockKeyhole, PanelRightOpen, Trash2 } from 'lucide-react';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { isStudentBlockedNode, studentNodeStatus } from '@/features/roadmap/student/node-status';
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
import { snapToRoadmapGrid } from '@/features/roadmap/graph/geometry';
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
import { cn } from '@/shared/lib/utils';

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

function RoadmapLegend({
  nodeTypes,
}: {
  nodeTypes: { id: string; name: string; color: string }[];
}) {
  return (
    <section
      aria-label="Leyenda del roadmap"
      className="absolute bottom-[18px] left-5 z-[4] flex max-w-[calc(100%-2.5rem)] flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border bg-card/92 px-3 py-2 text-xs shadow-sm"
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <span className="font-semibold text-foreground">Estado</span>
        <span className="size-2.5 rounded-full bg-progress" aria-hidden="true" />
        <span>Completado</span>
        <Circle className="size-3 fill-card text-graphite" aria-hidden="true" />
        <span>Disponible</span>
        <LockKeyhole className="size-3 text-graphite" aria-hidden="true" />
        <span>Bloqueado</span>
      </div>
      {nodeTypes.length ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-l border-border pl-3">
          <span className="font-semibold text-foreground">Tipos</span>
          {nodeTypes.map((type) => (
            <span key={type.id} className="inline-flex items-center gap-1 whitespace-nowrap">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundColor: type.color }}
                aria-hidden="true"
              />
              {type.name}
            </span>
          ))}
        </div>
      ) : null}
    </section>
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
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [pendingDependencyIds, setPendingDependencyIds] = useState<string[] | null>(null);
  const [pendingVisibilityChange, setPendingVisibilityChange] =
    useState<PendingVisibilityChange | null>(null);
  const [pendingDependencyChange, setPendingDependencyChange] =
    useState<PendingDependencyChange | null>(null);
  const [pendingTeacherBlockChange, setPendingTeacherBlockChange] =
    useState<PendingTeacherBlockChange | null>(null);
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
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

  function closeSelectedNode() {
    setSelectedNodeId(null);
    requestAnimationFrame(() => selectedNodeTriggerRef.current?.focus());
  }

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
  const teacherBlockDialog = pendingTeacherBlockChange
    ? teacherBlockConfirmation(
        pendingTeacherBlockChange.operation,
        pendingTeacherBlockChange.nodes.length,
      )
    : null;
  return (
    <div className="lg:h-full">
      <section
        className={cn(
          'relative box-border grid min-h-[calc(100dvh-4rem)] overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26_/_5%)] lg:h-full lg:min-h-0 lg:grid-rows-[minmax(0,1fr)]',
          canEdit && isEditorOpen ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'lg:grid-cols-1',
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
          {canEdit ? (
            <p className="pointer-events-none absolute right-5 bottom-[18px] z-[4] max-w-xs rounded-lg border border-border bg-card/92 px-3 py-2 text-xs leading-relaxed text-muted-foreground shadow-sm">
              Arrastra desde un punto de un nodo a otro para crear una dependencia. Selecciona una
              flecha para eliminarla con el botón{' '}
              <kbd className="rounded border bg-background px-1">X</kbd> o{' '}
              <kbd className="rounded border bg-background px-1">Supr</kbd>.
            </p>
          ) : null}
          <RoadmapLegend nodeTypes={roadmap.nodeTypes} />
          {error && <RoadmapErrorToast message={error} onDismiss={dismissError} />}
          <RoadmapGraph
            roadmap={roadmap}
            canEdit={canEdit}
            onSelectNode={(nodeId, trigger) => {
              const node = roadmap.nodes.find((candidate) => candidate.id === nodeId);
              if (!canEdit && isStudentBlockedNode(node)) return;
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
            }}
            onMoveNode={(_event, node) => void moveNode(node.id, snapToRoadmapGrid(node.position))}
            onConnectNodes={(connection) => void requestDependencyChange(connection)}
            onDeleteDependencies={setPendingDependencyIds}
            onAutoLayout={(nodes) => {
              void Promise.all(
                nodes.map((node) => moveNode(node.id, snapToRoadmapGrid(node.position))),
              );
            }}
            topRightActions={
              canEdit ? (
                <>
                  <NodeCreator
                    nodeTypes={roadmap.nodeTypes}
                    onSubmit={addNode}
                    onCreateNodeType={addNodeType}
                    onUpdateNodeType={updateNodeType}
                    onDeleteNodeType={deleteNodeType}
                  />
                  {!isEditorOpen ? (
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
              ) : undefined
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
            onUpdateNode={updateNode}
            onToggleVisibility={requestVisibilityChange}
            onRequestTeacherBlock={(nodeId, operation) =>
              void requestTeacherBlockChange(nodeId, operation)
            }
            onDeleteNode={deleteNode}
            onAddResource={addResource}
            onUploadResource={uploadResource}
            onUpdateResource={updateResource}
            onDeleteResource={deleteResource}
          />
        )}
        {!canEdit && (
          <StudentNodeDetail
            node={selectedNode as StudentRoadmapNode | undefined}
            status={selectedNode ? studentNodeStatus(selectedNode) : null}
            onClose={closeSelectedNode}
            onComplete={(node) => void completeNode(node.id)}
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
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar ocultación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Ocultarás el nodo y eliminarás {pendingVisibilityChange?.dependencies.length ?? 0}{' '}
              {pendingVisibilityChange?.dependencies.length === 1
                ? 'dependencia relacionada'
                : 'dependencias relacionadas'}
              .
            </AlertDialogDescription>
            <p className="text-sm text-muted-foreground">
              Estas dependencias no se restaurarán al volver a mostrar el nodo.
            </p>
            <ul className="list-disc pl-5 text-sm text-muted-foreground">
              {pendingVisibilityChange?.dependencies.map((dependency) => {
                const source = roadmap.nodes.find((node) => node.id === dependency.sourceNodeId);
                const target = roadmap.nodes.find((node) => node.id === dependency.targetNodeId);
                return (
                  <li key={dependency.id}>
                    {source?.title ?? dependency.sourceNodeId} →{' '}
                    {target?.title ?? dependency.targetNodeId}
                  </li>
                );
              })}
            </ul>
          </AlertDialogHeader>
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
    </div>
  );
}
