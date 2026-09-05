'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { Resource } from '@/features/roadmap/types';
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
import { Sidebar, SidebarContent, SidebarRail } from '@/shared/ui/sidebar';
import { panelWidthLimits } from '@/features/roadmap/ui/ResizablePanel';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import {
  emptyResourceEditorDraft,
  hasUnsavedNodeInformation,
  projectNodeInformationPreview,
  type ResourceEditorDraft,
} from './node-information-preview';
import type { NodeUpdate, RoadmapEditorProps } from './types';

type PendingDeletion = { label: string; onConfirm: () => Promise<boolean> } | null;

export function RoadmapEditor({
  roadmap,
  selectedNode,
  isOpen,
  onClose,
  onUpdateNode,
  onToggleVisibility,
  onRequestTeacherBlock,
  onDeleteNode,
  onAddResource,
  onUploadResource,
  onUpdateResource,
  onDeleteResource,
  onPreview,
  previewButtonRef,
  panelWidth,
  onPanelWidthChange,
}: RoadmapEditorProps) {
  const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
  const [isMobileEditorExpanded, setIsMobileEditorExpanded] = useState(false);
  const [draftNodeId, setDraftNodeId] = useState<string | null>(null);
  const [editNode, setEditNode] = useState<NodeUpdate>({
    title: '',
    description: '',
    nodeTypeId: '',
  });
  const [resourceDraft, setResourceDraft] = useState<ResourceEditorDraft>(
    emptyResourceEditorDraft,
  );

  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)');
    const update = () => setIsMobileEditorExpanded(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!selectedNode) {
      setDraftNodeId(null);
      return;
    }
    if (draftNodeId === selectedNode.id) return;
    setDraftNodeId(selectedNode.id);
    setEditNode({
      title: selectedNode.title,
      description: selectedNode.description ?? '',
      nodeTypeId: selectedNode.nodeTypeId,
    });
    setResourceDraft(emptyResourceEditorDraft());
  }, [draftNodeId, selectedNode]);

  if (!isOpen || !selectedNode || draftNodeId !== selectedNode.id) {
    return null;
  }

  const isDirty = hasUnsavedNodeInformation(selectedNode, editNode, resourceDraft);
  const closeResourceEditor = () => setResourceDraft(emptyResourceEditorDraft());
  const openResourceEditor = (mode: ResourceEditorDraft['mode']) =>
    setResourceDraft((draft) => ({ ...draft, isOpen: true, mode, selectedFile: null }));
  const startEditingResource = (resource: Resource) =>
    setResourceDraft({
      value: { title: resource.title, url: resource.url, type: resource.type },
      editingResourceId: resource.id,
      isOpen: true,
      mode: resource.type === 'FILE' ? 'file' : 'link',
      selectedFile: null,
    });

  return (
    <Sidebar
      side="right"
      collapsible="none"
      id="roadmap-editor-panel"
      aria-label="Panel de edición del roadmap"
      className="order-2 w-full! min-w-0 border-t border-border bg-background focus-within:ring-0 lg:order-0 lg:box-border lg:min-h-0 lg:w-(--sidebar-width)! lg:overflow-hidden lg:border-t-0 lg:border-l"
    >
      <SidebarRail
        ariaLabel="Redimensionar panel de edición"
        controlsId="roadmap-editor-panel"
        value={panelWidth}
        min={panelWidthLimits.min}
        max={panelWidthLimits.max}
        onValueChange={onPanelWidthChange}
        className="sm:hidden lg:flex"
      />
      <SidebarContent className="overflow-visible lg:overflow-y-auto">
        <details
          open={isMobileEditorExpanded}
          onToggle={(event) => setIsMobileEditorExpanded(event.currentTarget.open)}
        >
          <summary className="min-h-11 cursor-pointer border-b border-border bg-cloud/70 px-5 py-3 text-sm font-bold text-primary lg:hidden">
            Editor de nodo
          </summary>
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <NodeDetailsEditor
              node={selectedNode}
              nodeTypes={roadmap.nodeTypes}
              nodeValue={editNode}
              resourceValue={resourceDraft.value}
              editingResourceId={resourceDraft.editingResourceId}
              isResourceComposerOpen={resourceDraft.isOpen}
              resourceMode={resourceDraft.mode}
              selectedResourceFile={resourceDraft.selectedFile}
              isDirty={isDirty}
              onNodeChange={setEditNode}
              onResourceChange={(value) =>
                setResourceDraft((draft) => ({ ...draft, value }))
              }
              onResourceComposerOpen={openResourceEditor}
              onResourceComposerClose={closeResourceEditor}
              onResourceModeChange={(mode) =>
                setResourceDraft((draft) => ({ ...draft, mode }))
              }
              onSelectedResourceFileChange={(selectedFile) =>
                setResourceDraft((draft) => ({ ...draft, selectedFile }))
              }
              onUpdateNode={onUpdateNode}
              onToggleVisibility={onToggleVisibility}
              onRequestTeacherBlock={onRequestTeacherBlock}
              onAddResource={onAddResource}
              onUploadResource={onUploadResource}
              onUpdateResource={onUpdateResource}
              onStartEditingResource={startEditingResource}
              onCancelResource={closeResourceEditor}
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
              onPreview={() =>
                onPreview(projectNodeInformationPreview(selectedNode, editNode, resourceDraft))
              }
              previewButtonRef={previewButtonRef}
              onClose={onClose}
            />
          </div>
        </details>
      </SidebarContent>

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
    </Sidebar>
  );
}
