'use client';

import { useEffect, useState } from 'react';
import { PanelRightClose, PanelRightOpen, Trash2 } from 'lucide-react';
import type { Resource } from '@/lib/roadmap-types';
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
import { Button } from '@/components/ui/button';
import { NodeTypesEditor } from './NodeTypesEditor';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import type {
  NodeTypeInput,
  NodeUpdate,
  ResourceInput,
  RoadmapEditorProps,
} from './types';

type PendingDeletion = { label: string; onConfirm: () => Promise<boolean> } | null;

export function RoadmapEditor({
  roadmap,
  selectedNode,
  isOpen,
  onToggle,
  onClose,
  onUpdateNode,
  onToggleVisibility,
  onDeleteNode,
  onAddResource,
  onUpdateResource,
  onDeleteResource,
  onAddNodeType,
  onUpdateNodeType,
  onDeleteNodeType,
}: RoadmapEditorProps) {
  const [editNode, setEditNode] = useState<NodeUpdate>({
    title: '',
    description: '',
    nodeTypeId: '',
  });
  const [resource, setResource] = useState<ResourceInput>({ title: '', url: '', type: 'LINK' });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);
  const [nodeType, setNodeType] = useState<NodeTypeInput>({ name: '', color: '#024ad8' });
  const [editingNodeTypeId, setEditingNodeTypeId] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);

  useEffect(() => {
    setEditNode({
      title: selectedNode?.title ?? '',
      description: selectedNode?.description ?? '',
      nodeTypeId: selectedNode?.nodeTypeId ?? '',
    });
    setResource({ title: '', url: '', type: 'LINK' });
    setEditingResourceId(null);
  }, [selectedNode]);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const closeNodeTypeEditor = () => {
    setNodeType({ name: '', color: '#024ad8' });
    setEditingNodeTypeId(null);
  };

  const cancelResourceEditor = () => {
    setResource({ title: '', url: '', type: 'LINK' });
    setEditingResourceId(null);
  };

  const startEditingResource = (item: Resource) => {
    setEditingResourceId(item.id);
    setResource({ title: item.title, url: item.url, type: item.type });
  };

  if (!isOpen) {
    return (
      <Button
        aria-label="Mostrar panel de edición"
        title="Mostrar panel de edición"
        onClick={onToggle}
        size="icon"
        variant="outline"
        className="absolute top-[18px] right-5 z-[5] bg-white/95 text-primary shadow-sm"
      >
        <PanelRightOpen />
      </Button>
    );
  }

  return (
    <aside
      aria-label="Panel de edición del roadmap"
      className="order-2 min-w-0 border-t border-border bg-cloud lg:order-none lg:h-[calc(100vh-64px)] lg:overflow-y-auto lg:border-t-0 lg:border-r-4 lg:border-l lg:border-r-primary lg:border-l-border"
    >
      <details
        open={isMobileEditorExpanded}
        onToggle={(event) => setIsMobileEditorExpanded(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer px-5 py-3 text-sm font-bold text-primary lg:hidden">
          Herramientas de edición
        </summary>
        <div className="flex flex-col gap-4 p-4 sm:p-5">
          <header className="flex items-start justify-between gap-4 border-b border-border pb-4">
            <div>
              <p className="text-xs font-bold tracking-[0.12em] text-primary uppercase">
                Mesa de edición
              </p>
              <h2 className="mt-1 font-heading text-2xl font-semibold tracking-[-0.035em]">
                Diseña el recorrido
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {roadmap.nodes.length} nodos · {roadmap.nodeTypes.length} tipos
              </p>
            </div>
            <Button
              aria-label="Ocultar panel de edición"
              title="Ocultar panel de edición"
              onClick={onToggle}
              size="icon"
              variant="outline"
            >
              <PanelRightClose />
            </Button>
          </header>

          {selectedNode ? (
            <NodeDetailsEditor
              key={selectedNode.id}
              node={selectedNode}
              nodeTypes={roadmap.nodeTypes}
              nodeValue={editNode}
              resourceValue={resource}
              editingResourceId={editingResourceId}
              onNodeChange={setEditNode}
              onResourceChange={setResource}
              onUpdateNode={onUpdateNode}
              onToggleVisibility={onToggleVisibility}
              onAddResource={onAddResource}
              onUpdateResource={onUpdateResource}
              onStartEditingResource={startEditingResource}
              onCancelResource={cancelResourceEditor}
              onDeleteNode={(node) =>
                setPendingDeletion({
                  label: `el nodo ${node.title} y sus dependencias y recursos`,
                  onConfirm: async () => {
                    const deleted = await onDeleteNode(node.id);
                    if (deleted) onClose();
                    return deleted;
                  },
                })
              }
              onDeleteResource={(item) =>
                setPendingDeletion({
                  label: `el recurso ${item.title}`,
                  onConfirm: () => onDeleteResource(item.id),
                })
              }
              onClose={onClose}
            />
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-background px-3 py-3 text-sm leading-snug text-muted-foreground">
              Selecciona un nodo del mapa para editar sus detalles, visibilidad y recursos.
            </p>
          )}

          <NodeTypesEditor
            nodeTypes={roadmap.nodeTypes}
            value={nodeType}
            editingId={editingNodeTypeId}
            onChange={setNodeType}
            onStartEditing={(id, value) => {
              setEditingNodeTypeId(id);
              setNodeType(value);
            }}
            onCloseEditor={closeNodeTypeEditor}
            onAdd={onAddNodeType}
            onUpdate={onUpdateNodeType}
            onDelete={(id, name) =>
              setPendingDeletion({
                label: `el tipo ${name}`,
                onConfirm: () => onDeleteNodeType(id),
              })
            }
          />
        </div>
      </details>

      <AlertDialog
        open={Boolean(pendingDeletion)}
        onOpenChange={(open) => !open && setPendingDeletion(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-semibold">
              Confirmar eliminación
            </AlertDialogTitle>
            <AlertDialogDescription>
              Eliminarás {pendingDeletion?.label}. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              variant="destructive"
              onClick={() =>
                void pendingDeletion?.onConfirm().then((deleted) => {
                  if (deleted) setPendingDeletion(null);
                })
              }
            >
              <Trash2 data-icon="inline-start" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}
