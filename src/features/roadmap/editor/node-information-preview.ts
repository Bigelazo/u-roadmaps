import type { RoadmapNode, StudentAccessibleRoadmapNode } from '@/features/roadmap/types';
import type { NodeUpdate, ResourceSession } from './types';
import { resourceSessionIsDirtyForNode } from './session';

function nodeFormHasChanges(node: RoadmapNode, value: NodeUpdate) {
  return (
    value.title !== node.title ||
    value.description !== (node.description ?? '') ||
    value.nodeTypeId !== node.nodeTypeId
  );
}

export function hasUnsavedNodeInformation(
  node: RoadmapNode,
  nodeValue: NodeUpdate,
  resourceSession: ResourceSession,
) {
  return (
    nodeFormHasChanges(node, nodeValue) || resourceSessionIsDirtyForNode(node, resourceSession)
  );
}

export function projectNodeInformationPreview(
  node: RoadmapNode,
  nodeValue: NodeUpdate,
  resourceSession: ResourceSession,
): StudentAccessibleRoadmapNode {
  let resources = node.resources;

  if (resourceSessionIsDirtyForNode(node, resourceSession)) {
    if (resourceSession.kind === 'editing-existing') {
      resources = node.resources.map((resource) =>
        resource.id === resourceSession.resourceId
          ? { ...resource, ...resourceSession.value }
          : resource,
      );
    } else if (resourceSession.kind === 'adding-file' && resourceSession.selectedFile) {
      resources = [
        ...resources,
        {
          id: 'node-information-preview-file',
          title: resourceSession.selectedFile.name,
          url: '#',
          type: 'FILE' as const,
        },
      ];
    } else if (resourceSession.kind === 'adding-link') {
      resources = [
        ...resources,
        {
          id: 'node-information-preview-resource',
          ...resourceSession.value,
        },
      ];
    }
  }

  return {
    id: node.id,
    title: nodeValue.title,
    description: nodeValue.description || null,
    nodeTypeId: nodeValue.nodeTypeId,
    positionX: node.positionX,
    positionY: node.positionY,
    isVisible: true,
    access: { status: 'ACCESSIBLE' },
    isCompleted: false,
    canComplete: true,
    resources,
  };
}
