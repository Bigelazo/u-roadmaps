import type { RoadmapNode, StudentAccessibleRoadmapNode } from '@/features/roadmap/types';
import type { NodeUpdate, ResourceInput } from './types';

export type ResourceEditorDraft = {
  value: ResourceInput;
  editingResourceId: string | null;
  isOpen: boolean;
  mode: 'file' | 'link';
  selectedFile: File | null;
};

export function emptyResourceEditorDraft(): ResourceEditorDraft {
  return {
    value: { title: '', url: '', type: 'LINK' },
    editingResourceId: null,
    isOpen: false,
    mode: 'file',
    selectedFile: null,
  };
}

function nodeFormHasChanges(node: RoadmapNode, value: NodeUpdate) {
  return (
    value.title !== node.title ||
    value.description !== (node.description ?? '') ||
    value.nodeTypeId !== node.nodeTypeId
  );
}

function resourceDraftHasChanges(node: RoadmapNode, draft: ResourceEditorDraft) {
  if (!draft.isOpen) return false;
  if (!draft.editingResourceId) {
    return Boolean(draft.selectedFile || draft.value.title.trim() || draft.value.url.trim());
  }

  const resource = node.resources.find((item) => item.id === draft.editingResourceId);
  return (
    !resource ||
    draft.value.title !== resource.title ||
    draft.value.url !== resource.url ||
    draft.value.type !== resource.type
  );
}

export function hasUnsavedNodeInformation(
  node: RoadmapNode,
  nodeValue: NodeUpdate,
  resourceDraft: ResourceEditorDraft,
) {
  return nodeFormHasChanges(node, nodeValue) || resourceDraftHasChanges(node, resourceDraft);
}

export function projectNodeInformationPreview(
  node: RoadmapNode,
  nodeValue: NodeUpdate,
  resourceDraft: ResourceEditorDraft,
): StudentAccessibleRoadmapNode {
  const resourceChanges = resourceDraftHasChanges(node, resourceDraft);
  let resources = node.resources;

  if (resourceChanges && resourceDraft.editingResourceId) {
    resources = node.resources.map((resource) =>
      resource.id === resourceDraft.editingResourceId ? { ...resource, ...resourceDraft.value } : resource,
    );
  } else if (resourceChanges && !resourceDraft.editingResourceId) {
    const resource = resourceDraft.selectedFile
      ? {
          id: 'node-information-preview-file',
          title: resourceDraft.selectedFile.name,
          url: '#',
          type: 'FILE' as const,
        }
      : {
          id: 'node-information-preview-resource',
          ...resourceDraft.value,
        };
    resources = [...resources, resource];
  }

  return {
    id: node.id,
    title: nodeValue.title,
    description: nodeValue.description || null,
    nodeTypeId: node.nodeTypeId,
    positionX: node.positionX,
    positionY: node.positionY,
    isVisible: true,
    access: { status: 'ACCESSIBLE' },
    isCompleted: false,
    canComplete: true,
    resources,
  };
}
