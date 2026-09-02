'use client';

import { useEffect, useState } from 'react';
import { PanelRightClose, Trash2 } from 'lucide-react';
import type { Resource, RoadmapDto, RoadmapNode } from '@/lib/roadmap-types';
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
import { Button } from '@/shared/ui/button';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import type { NodeUpdate, ResourceInput, RoadmapEditorProps } from './types';

type PendingDeletion = { label: string; onConfirm: () => Promise<boolean> } | null;

type SelectedNodeEditorProps = {
  node: RoadmapNode;
  nodeTypes: RoadmapDto['nodeTypes'];
  onUpdateNode: RoadmapEditorProps['onUpdateNode'];
  onToggleVisibility: RoadmapEditorProps['onToggleVisibility'];
  onRequestTeacherBlock: RoadmapEditorProps['onRequestTeacherBlock'];
  onAddResource: RoadmapEditorProps['onAddResource'];
  onUploadResource: RoadmapEditorProps['onUploadResource'];
  onUpdateResource: RoadmapEditorProps['onUpdateResource'];
  onDeleteNode: (node: RoadmapNode) => void;
  onDeleteResource: (resource: Resource) => void;
  onClose: () => void;
};

function SelectedNodeEditor({
  node,
  nodeTypes,
  onUpdateNode,
  onToggleVisibility,
  onRequestTeacherBlock,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onDeleteNode,
  onDeleteResource,
  onClose,
}: SelectedNodeEditorProps) {
  const [editNode, setEditNode] = useState<NodeUpdate>(() => ({
    title: node.title,
    description: node.description ?? '',
    nodeTypeId: node.nodeTypeId,
  }));
  const [resource, setResource] = useState<ResourceInput>({ title: '', url: '', type: 'LINK' });
  const [editingResourceId, setEditingResourceId] = useState<string | null>(null);

  const cancelResourceEditor = () => {
    setResource({ title: '', url: '', type: 'LINK' });
    setEditingResourceId(null);
  };

  const startEditingResource = (item: Resource) => {
    setEditingResourceId(item.id);
    setResource({ title: item.title, url: item.url, type: item.type });
  };

  return (
    <NodeDetailsEditor
      node={node}
      nodeTypes={nodeTypes}
      nodeValue={editNode}
      resourceValue={resource}
      editingResourceId={editingResourceId}
      onNodeChange={setEditNode}
      onResourceChange={setResource}
      onUpdateNode={onUpdateNode}
      onToggleVisibility={onToggleVisibility}
      onRequestTeacherBlock={onRequestTeacherBlock}
      onAddResource={onAddResource}
      onUploadResource={onUploadResource}
      onUpdateResource={onUpdateResource}
      onStartEditingResource={startEditingResource}
      onCancelResource={cancelResourceEditor}
      onDeleteNode={onDeleteNode}
      onDeleteResource={onDeleteResource}
      onClose={onClose}
    />
  );
}

export function RoadmapEditor({
  roadmap,
  selectedNode,
  isOpen,
  onToggle,
  onClose,
  onUpdateNode,
  onToggleVisibility,
  onRequestTeacherBlock,
  onDeleteNode,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onDeleteResource,
}: RoadmapEditorProps) {
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      aria-label="Panel de edición del roadmap"
      className="order-2 min-w-0 border-t border-border bg-background lg:order-none lg:box-border lg:min-h-0 lg:overflow-y-auto lg:border-t-0 lg:border-l"
    >
      <details
        open={isMobileEditorExpanded}
        onToggle={(event) => setIsMobileEditorExpanded(event.currentTarget.open)}
      >
        <summary className="min-h-11 cursor-pointer border-b border-border bg-cloud/70 px-5 py-3 text-sm font-bold text-primary lg:hidden">
          Editor de nodo
        </summary>
        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
          <header className="flex justify-end py-3">
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
            <SelectedNodeEditor
              key={selectedNode.id}
              node={selectedNode}
              nodeTypes={roadmap.nodeTypes}
              onUpdateNode={onUpdateNode}
              onToggleVisibility={onToggleVisibility}
              onRequestTeacherBlock={onRequestTeacherBlock}
              onAddResource={onAddResource}
              onUploadResource={onUploadResource}
              onUpdateResource={onUpdateResource}
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
