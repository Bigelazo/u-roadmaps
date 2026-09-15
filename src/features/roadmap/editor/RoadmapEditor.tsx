'use client';

import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Resource, RoadmapNode } from '@/features/roadmap/types';
import {
  roadmapConfirmationActionIds,
  roadmapNodeDeletionConfirmation,
  resourceDeletionConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import {
  emptyResourceEditorDraft,
  projectNodeInformationPreview,
} from './node-information-preview';
import type { ResourceEditorDraft, RoadmapEditorDraftHandle, RoadmapEditorProps } from './types';
import { useRoadmapEditorDraft } from './useRoadmapEditorDraft';

type PendingDeletion =
  { kind: 'node'; node: RoadmapNode } | { kind: 'resource'; resource: Resource } | null;

export const RoadmapEditor = forwardRef<RoadmapEditorDraftHandle, RoadmapEditorProps>(
  function RoadmapEditor(
    {
      roadmap,
      selectedNode,
      isVisibilityPending,
      resourceComposerRequest,
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
    }: RoadmapEditorProps,
    ref,
  ) {
    const [pendingDeletion, setPendingDeletion] = useState<PendingDeletion>(null);
    const [pendingDeletionActionId, setPendingDeletionActionId] = useState<string>();
    const draft = useRoadmapEditorDraft(selectedNode);
    const { draftNodeId, editNode, resourceDraft, isDirty, reset, setEditNode, setResourceDraft } =
      draft;

    useImperativeHandle(ref, () => ({ draftNodeId, isDirty, reset }), [
      draftNodeId,
      isDirty,
      reset,
    ]);

    useEffect(() => {
      if (!resourceComposerRequest || draftNodeId !== selectedNode?.id) return;
      setResourceDraft((draft) =>
        draft.isOpen ? draft : { ...emptyResourceEditorDraft(), isOpen: true, mode: 'file' },
      );
      const frame = requestAnimationFrame(() => {
        (
          document.getElementById('resource-file') ?? document.getElementById('resource-title')
        )?.focus();
      });
      return () => cancelAnimationFrame(frame);
    }, [draftNodeId, resourceComposerRequest, selectedNode?.id, setResourceDraft]);

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

    const pendingDeletionConfirmation = pendingDeletion
      ? pendingDeletion.kind === 'node'
        ? roadmapNodeDeletionConfirmation(roadmap, pendingDeletion.node)
        : resourceDeletionConfirmation(pendingDeletion.resource)
      : null;

    function cancelPendingDeletion() {
      if (pendingDeletionActionId) return;
      setPendingDeletion(null);
    }

    function handlePendingDeletionAction(actionId: string) {
      if (!pendingDeletion || pendingDeletionActionId) return;

      const expectedActionId =
        pendingDeletion.kind === 'node'
          ? roadmapConfirmationActionIds.deleteNode
          : roadmapConfirmationActionIds.deleteResource;
      if (actionId !== expectedActionId) return;

      setPendingDeletionActionId(actionId);
      void (async () => {
        try {
          const deleted =
            pendingDeletion.kind === 'node'
              ? await onDeleteNode(pendingDeletion.node.id)
              : await onDeleteResource(pendingDeletion.resource.id);
          if (deleted) {
            setPendingDeletion(null);
            if (pendingDeletion.kind === 'node') onClose();
          }
        } finally {
          setPendingDeletionActionId(undefined);
        }
      })();
    }

    return (
      <>
        {selectedNode && draftNodeId === selectedNode.id ? (
          <NodeDetailsEditor
            node={selectedNode}
            nodeTypes={roadmap.nodeTypes}
            nodeValue={editNode}
            resourceValue={resourceDraft.value}
            editingResourceId={resourceDraft.editingResourceId}
            isResourceComposerOpen={resourceDraft.isOpen}
            isVisibilityPending={isVisibilityPending}
            resourceMode={resourceDraft.mode}
            selectedResourceFile={resourceDraft.selectedFile}
            isDirty={isDirty}
            onNodeChange={setEditNode}
            onResourceChange={(value) => setResourceDraft((draft) => ({ ...draft, value }))}
            onResourceComposerOpen={openResourceEditor}
            onResourceComposerClose={closeResourceEditor}
            onResourceModeChange={(mode) => setResourceDraft((draft) => ({ ...draft, mode }))}
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
            onDeleteNode={(node) => setPendingDeletion({ kind: 'node', node })}
            onDeleteResource={(resource) => setPendingDeletion({ kind: 'resource', resource })}
            onPreview={() =>
              onPreview(projectNodeInformationPreview(selectedNode, editNode, resourceDraft))
            }
            previewButtonRef={previewButtonRef}
            onClose={onClose}
          />
        ) : null}
        <ConfirmationDialog
          confirmation={pendingDeletionConfirmation}
          pendingActionId={pendingDeletionActionId}
          onCancel={cancelPendingDeletion}
          onAction={handlePendingDeletionAction}
        />
      </>
    );
  },
);
