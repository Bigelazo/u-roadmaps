'use client';

import { createContext, useContext, type RefObject } from 'react';
import type {
  RoadmapDto,
  RoadmapNode,
  Resource,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import type { PendingEditorEffect } from './session';
import type { NodeUpdate, ResourceInput, ResourceSession } from './types';

export type NodeEditorContextValue = {
  node: RoadmapNode;
  nodeTypes: RoadmapDto['nodeTypes'];
  nodeDraft: NodeUpdate;
  resourceSession: ResourceSession;
  isDirty: boolean;
  isNodeDirty: boolean;
  canSaveNode: boolean;
  isVisibilityPending: boolean;
  pendingEditorEffect: PendingEditorEffect | null;
  pendingResourceDeletion: Resource | null;
  previewButtonRef: RefObject<HTMLButtonElement | null>;
  changeNodeDraft: (value: NodeUpdate) => void;
  changeResource: (value: ResourceInput) => void;
  openResource: (mode: 'file' | 'link') => void;
  editResource: (resource: Resource) => void;
  changeResourceMode: (mode: 'file' | 'link') => void;
  selectResourceFile: (file: File | null) => void;
  closeResource: () => void;
  saveNode: () => void;
  saveResource: () => void;
  requestResourceDeletion: (resource: Resource) => void;
  cancelResourceDeletion: () => void;
  toggleVisibility: () => void;
  requestTeacherBlock: (operation: TeacherBlockOperation) => void;
  requestNodeDeletion: () => void;
  closeNode: () => void;
  previewNodeInformation: () => void;
};

const NodeEditorContext = createContext<NodeEditorContextValue | null>(null);

export const NodeEditorProvider = NodeEditorContext.Provider;

export function useNodeEditorContext() {
  const context = useContext(NodeEditorContext);
  if (!context) throw new Error('useNodeEditorContext must be used within NodeEditor');
  return context;
}
