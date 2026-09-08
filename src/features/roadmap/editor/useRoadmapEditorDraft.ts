import { useCallback, useState } from 'react';
import type { RoadmapNode } from '@/features/roadmap/types';
import { emptyResourceEditorDraft, hasUnsavedNodeInformation } from './node-information-preview';
import type { NodeUpdate, RoadmapEditorDraft } from './types';

const emptyNodeDraft: NodeUpdate = {
  title: '',
  description: '',
  nodeTypeId: '',
};

export function useRoadmapEditorDraft(selectedNode: RoadmapNode | undefined): RoadmapEditorDraft {
  const draftNodeId = selectedNode?.id ?? null;
  const [editNode, setEditNode] = useState<NodeUpdate>(() =>
    selectedNode
      ? {
          title: selectedNode.title,
          description: selectedNode.description ?? '',
          nodeTypeId: selectedNode.nodeTypeId,
        }
      : emptyNodeDraft,
  );
  const [resourceDraft, setResourceDraft] = useState(emptyResourceEditorDraft);

  const reset = useCallback(() => {
    setEditNode(
      selectedNode
        ? {
            title: selectedNode.title,
            description: selectedNode.description ?? '',
            nodeTypeId: selectedNode.nodeTypeId,
          }
        : emptyNodeDraft,
    );
    setResourceDraft(emptyResourceEditorDraft());
  }, [selectedNode]);

  const isDirty = Boolean(
    selectedNode &&
    draftNodeId === selectedNode.id &&
    hasUnsavedNodeInformation(selectedNode, editNode, resourceDraft),
  );

  return {
    draftNodeId,
    editNode,
    resourceDraft,
    isDirty,
    setEditNode,
    setResourceDraft,
    reset,
  };
}
