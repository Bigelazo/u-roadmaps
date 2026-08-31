'use client';

import { useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Circle, CircleAlert, LockKeyhole, PanelRightOpen, Trash2 } from 'lucide-react';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { RoadmapErrorToast } from '@/features/roadmap/RoadmapErrorToast';
import { NodeCreator } from '@/features/roadmap/editor/NodeCreator';
import { RoadmapGraph } from '@/features/roadmap/graph/RoadmapGraph';
import { StudentNodeDetail } from '@/features/roadmap/student/NodeDetail';
import { studentNodeStatus } from '@/features/roadmap/student/node-status';
import { useRoadmap } from '@/features/roadmap/useRoadmap';
import { snapToRoadmapGrid } from '@/lib/roadmap-geometry';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Spinner } from '@/components/ui/spinner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
  const {
    roadmap,
    error,
    dismissError,
    addNode,
    updateNode,
    moveNode,
    connectNodes,
    deleteDependency,
    toggleVisibility,
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
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
            }}
            onMoveNode={(_event, node) => void moveNode(node.id, snapToRoadmapGrid(node.position))}
            onConnectNodes={(connection) => {
              if (connection.source && connection.target)
                void connectNodes(
                  connection.source,
                  connection.target,
                  connection.sourceHandle ?? undefined,
                  connection.targetHandle ?? undefined,
                );
            }}
            onDeleteDependencies={setPendingDependencyIds}
            onToggleNodeVisibility={(nodeId, isVisible) => void toggleVisibility(nodeId, isVisible)}
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
            roadmap={roadmap}
            selectedNode={selectedNode}
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen((isOpen) => !isOpen)}
            onClose={closeSelectedNode}
            onUpdateNode={updateNode}
            onToggleVisibility={toggleVisibility}
            onDeleteNode={deleteNode}
            onAddResource={addResource}
            onUploadResource={uploadResource}
            onUpdateResource={updateResource}
            onDeleteResource={deleteResource}
          />
        )}
        {!canEdit && (
          <StudentNodeDetail
            node={selectedNode}
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
    </div>
  );
}
