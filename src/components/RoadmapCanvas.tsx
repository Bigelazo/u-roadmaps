'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Circle, CircleAlert, LockKeyhole, Trash2 } from 'lucide-react';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { RoadmapErrorToast } from '@/components/roadmap/RoadmapErrorToast';
import { RoadmapGraph } from '@/components/roadmap/RoadmapGraph';
import { StudentNodeDetail } from '@/components/roadmap/StudentNodeDetail';
import { studentNodeStatus } from '@/components/roadmap/node-status';
import { useRoadmap } from '@/components/roadmap/useRoadmap';
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
import { cn } from '@/lib/utils';

const RoadmapEditor = dynamic(
  () => import('@/components/roadmap/RoadmapEditor').then(({ RoadmapEditor }) => RoadmapEditor),
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
    updateResource,
    deleteResource,
    addNodeType,
    updateNodeType,
    deleteNodeType,
    completeNode,
  } = useRoadmap(identifier);

  useEffect(() => {
    setSelectedNodeId(null);
  }, [identifier.courseCode, identifier.year, identifier.semester]);

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
    <div>
      <section
        className={cn(
          'relative grid min-h-[calc(100vh-64px)] overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26_/_5%)] sm:rounded-xl',
          canEdit && isEditorOpen ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'lg:grid-cols-1',
        )}
      >
        <div
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[540px] bg-background lg:min-h-[calc(100vh-64px)]"
        >
          <header className="pointer-events-none absolute top-4 left-4 z-[4] max-w-[calc(100%-2rem)] sm:top-6 sm:left-6 sm:max-w-md">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{courseCode}</Badge>
              {canEdit ? <Badge variant="secondary">Modo edición</Badge> : null}
            </div>
            <h1 className="mt-2 font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] text-balance sm:text-[30px]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {year}, semestre {semester}
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
          <section
            aria-label="Estados del roadmap"
            className="absolute bottom-[18px] left-5 z-[4] flex items-center gap-2 rounded-lg border border-border bg-card/92 px-2.5 py-1.5 text-xs shadow-sm"
          >
            <span className="size-2.5 rounded-full bg-progress" />
            <span>Completado</span>
            <Circle className="size-3 fill-card text-graphite" aria-hidden="true" />
            <span>Disponible</span>
            <LockKeyhole className="size-3 text-graphite" aria-hidden="true" />
            <span>Bloqueado</span>
          </section>
          {error && <RoadmapErrorToast message={error} onDismiss={dismissError} />}
          <RoadmapGraph
            roadmap={roadmap}
            canEdit={canEdit}
            onSelectNode={(nodeId, trigger) => {
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
            }}
            onMoveNode={(_event, node) =>
              void moveNode(node.id, snapToRoadmapGrid(node.position))
            }
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
          />
        </div>
        {canEdit && (
          <RoadmapEditor
            roadmap={roadmap}
            selectedNode={selectedNode}
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen((isOpen) => !isOpen)}
            onClose={closeSelectedNode}
            onAddNode={addNode}
            onUpdateNode={updateNode}
            onToggleVisibility={toggleVisibility}
            onDeleteNode={deleteNode}
            onAddResource={addResource}
            onUpdateResource={updateResource}
            onDeleteResource={deleteResource}
            onAddNodeType={addNodeType}
            onUpdateNodeType={updateNodeType}
            onDeleteNodeType={deleteNodeType}
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
