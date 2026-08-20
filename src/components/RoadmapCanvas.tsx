'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Circle, LockKeyhole, Trash2 } from 'lucide-react';
import type { CourseOfferingIdentifier } from '@/lib/roadmap-api';
import { RoadmapGraph } from '@/components/roadmap/RoadmapGraph';
import { StudentNodeDetail } from '@/components/roadmap/StudentNodeDetail';
import { studentNodeStatus } from '@/components/roadmap/node-status';
import { useRoadmap } from '@/components/roadmap/useRoadmap';
import { Button } from '@/components/ui/button';

const RoadmapEditor = dynamic(
  () => import('@/components/roadmap/RoadmapEditor').then(({ RoadmapEditor }) => RoadmapEditor),
  { ssr: false },
);

type Props = {
  identifier: CourseOfferingIdentifier;
  canEdit?: boolean;
  title: string;
  subtitle: string;
};

export default function RoadmapCanvas({ identifier, canEdit = false, title, subtitle }: Props) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedDependencyId, setSelectedDependencyId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(true);
  const [pendingDependencyIds, setPendingDependencyIds] = useState<string[] | null>(null);
  const selectedNodeTriggerRef = useRef<HTMLElement | null>(null);
  const graphRef = useRef<HTMLDivElement | null>(null);
  const {
    roadmap,
    error,
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
    setSelectedDependencyId(null);
  }, [identifier.courseCode, identifier.year, identifier.semester]);

  function closeSelectedNode() {
    setSelectedNodeId(null);
    requestAnimationFrame(() => selectedNodeTriggerRef.current?.focus());
  }

  function closeSelectedDependency() {
    setSelectedDependencyId(null);
    requestAnimationFrame(() => graphRef.current?.focus());
  }

  if (error && !roadmap)
    return (
      <p
        role="alert"
        className="m-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
      >
        {error}
      </p>
    );
  if (!roadmap)
    return (
      <p className="m-4 rounded-xl border bg-card p-8 text-muted-foreground">Cargando roadmap...</p>
    );

  const selectedNode = roadmap.nodes.find((node) => node.id === selectedNodeId);
  const selectedDependency = roadmap.dependencies.find(
    (dependency) => dependency.id === selectedDependencyId,
  );
  return (
    <div>
      {error && (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-destructive"
        >
          {error}
        </p>
      )}
      <section
        className={`relative grid min-h-[calc(100vh-64px)] overflow-hidden border border-border bg-card shadow-[0_2px_9px_rgb(26_26_26_/_5%)] sm:rounded-xl ${canEdit && isEditorOpen ? 'lg:grid-cols-[minmax(0,1fr)_360px]' : 'lg:grid-cols-1'}`}
      >
        <div
          ref={graphRef}
          tabIndex={-1}
          aria-label="Lienzo del roadmap"
          className="relative min-h-[540px] bg-[#fdfdfe] lg:min-h-[calc(100vh-64px)]"
        >
          <header className="pointer-events-none absolute top-6 left-6 z-[4]">
            <h1 className="font-heading text-[23px] leading-none font-semibold tracking-[-0.045em] sm:text-[30px]">
              {title}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </header>
          <div className="absolute bottom-[18px] left-5 z-[4] flex items-center gap-2 rounded-lg border border-border bg-white/92 px-2.5 py-1.5 text-xs">
            <span className="size-2.5 rounded-full bg-progress" />
            <span>Completado</span>
            <Circle size={12} color="#6d7180" fill="#fff" />
            <span>Disponible</span>
            <LockKeyhole size={13} color="#777b8c" />
            <span>Bloqueado</span>
          </div>
          <RoadmapGraph
            roadmap={roadmap}
            canEdit={canEdit}
            onSelectNode={(nodeId, trigger) => {
              selectedNodeTriggerRef.current = trigger;
              setSelectedNodeId(nodeId);
              setSelectedDependencyId(null);
            }}
            onMoveNode={(_event, node) => void moveNode(node.id, node.position)}
            onConnectNodes={(connection) => {
              if (connection.source && connection.target)
                void connectNodes(
                  connection.source,
                  connection.target,
                  connection.sourceHandle ?? undefined,
                  connection.targetHandle ?? undefined,
                );
            }}
            onSelectDependency={(dependencyId) => {
              setSelectedDependencyId(dependencyId);
              setSelectedNodeId(null);
            }}
            onDeleteDependencies={setPendingDependencyIds}
          />
        </div>
        {canEdit && (
          <RoadmapEditor
            roadmap={roadmap}
            selectedNode={selectedNode}
            selectedDependency={selectedDependency}
            isOpen={isEditorOpen}
            onToggle={() => setIsEditorOpen((isOpen) => !isOpen)}
            onClose={closeSelectedNode}
            onAddNode={addNode}
            onUpdateNode={updateNode}
            onToggleVisibility={toggleVisibility}
            onDeleteNode={deleteNode}
            onAddDependency={connectNodes}
            onDeleteDependency={deleteDependency}
            onCloseDependency={closeSelectedDependency}
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
      <AlertDialog.Root
        open={Boolean(pendingDependencyIds?.length)}
        onOpenChange={(open) => !open && setPendingDependencyIds(null)}
      >
        <AlertDialog.Portal>
          <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-ink/30" />
          <AlertDialog.Viewport className="fixed inset-0 z-50 grid place-items-center p-4">
            <AlertDialog.Popup className="w-full max-w-md rounded-xl bg-card p-6 shadow-[0_18px_50px_rgb(18_33_58_/_18%)]">
              <AlertDialog.Title className="font-heading text-xl font-semibold">
                Confirmar eliminación
              </AlertDialog.Title>
              <AlertDialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
                Eliminarás{' '}
                {pendingDependencyIds?.length === 1 ? 'esta dependencia' : 'estas dependencias'}.
                Esta acción no se puede deshacer.
              </AlertDialog.Description>
              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPendingDependencyIds(null)}
                >
                  Cancelar
                </Button>
                <Button
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
                </Button>
              </div>
            </AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
