'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  editorDraftDiscardConfirmation,
  roadmapConfirmationActionIds,
  resourceDeletionConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import type { Resource, TeacherBlockOperation } from '@/features/roadmap/types';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import { NodeEditorProvider } from './context';
import {
  createNodeEditorState,
  nodeDraftIsDirty,
  nodeEditorReducer,
  nodeEditorStateIsDirty,
  resourceSessionIsDirtyForNode,
  type NodeEditorAction,
} from './session';
import { projectNodeInformationPreview } from './node-information-preview';
import type {
  NodeEditorEffect,
  NodeEditorGuardReason,
  NodeEditorHandle,
  NodeEditorProps,
  NodeEditorPerformResult,
  ResourceInput,
} from './types';

function isGuardRelevant(reason: NodeEditorGuardReason, nodeId: string | null) {
  if (!nodeId) return false;
  if (reason.kind === 'enter-canvas-preview') return true;
  if (reason.kind === 'replace-node' || reason.kind === 'open-resource') {
    return reason.nodeId !== nodeId;
  }
  return reason.nodeId === nodeId;
}

function isCommitted(result: NodeEditorPerformResult) {
  return result.status === 'committed';
}

export const NodeEditor = forwardRef<NodeEditorHandle, NodeEditorProps>(function NodeEditor(
  { session, command, perform, onIntent },
  ref,
) {
  const { node, nodeTypes, isVisibilityPending } = session;
  const [state, dispatch] = useReducer(nodeEditorReducer, node, createNodeEditorState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const mountedRef = useRef(true);
  const guardResolverRef = useRef<((proceed: boolean) => void) | null>(null);
  const effectIdRef = useRef(0);
  const handledCommandIdRef = useRef<string | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      guardResolverRef.current?.(false);
      guardResolverRef.current = null;
    };
  }, []);

  const transition = useCallback((action: NodeEditorAction) => {
    stateRef.current = nodeEditorReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  useEffect(() => {
    if ((node?.id ?? null) !== stateRef.current.nodeId) {
      transition({ type: 'replace-node', node });
    } else if (node) {
      transition({ type: 'canonical-refresh', node });
    }
  }, [node, transition]);

  const guardDraft = useCallback(
    (reason: NodeEditorGuardReason) => {
      const current = stateRef.current;
      if (!isGuardRelevant(reason, current.nodeId) || !nodeEditorStateIsDirty(current)) {
        return Promise.resolve(true);
      }
      if (current.pendingGuard) return Promise.resolve(false);

      return new Promise<boolean>((resolve) => {
        guardResolverRef.current = resolve;
        transition({ type: 'request-guard', reason });
      });
    },
    [transition],
  );

  useImperativeHandle(ref, () => ({ guardDraft }), [guardDraft]);

  const startEffect = useCallback(
    (effect: NodeEditorEffect) => {
      const current = stateRef.current;
      if (current.pendingEditorEffect || !current.nodeId) return;

      const pending = {
        id: ++effectIdRef.current,
        epoch: current.epoch,
        effect,
      };
      transition({ type: 'start-effect', pending });
      void Promise.resolve()
        .then(() => perform(effect))
        .then((result) => {
          if (!mountedRef.current) return;
          transition({
            type: 'resolve-effect',
            effectId: pending.id,
            epoch: pending.epoch,
            status: isCommitted(result) ? 'committed' : 'rejected',
          });
        })
        .catch(() => {
          if (!mountedRef.current) return;
          transition({
            type: 'resolve-effect',
            effectId: pending.id,
            epoch: pending.epoch,
            status: 'rejected',
          });
        });
    },
    [perform, transition],
  );

  const saveNode = useCallback(() => {
    const current = stateRef.current;
    const currentNode = current.canonicalNode;
    if (
      !currentNode ||
      current.pendingEditorEffect ||
      !nodeDraftIsDirty(currentNode, current.nodeDraft) ||
      !current.nodeDraft.title.trim()
    )
      return;
    startEffect({ kind: 'update-node', nodeId: currentNode.id, value: current.nodeDraft });
  }, [startEffect]);

  const saveResource = useCallback(() => {
    const current = stateRef.current;
    const currentNode = current.canonicalNode;
    const session = current.resourceSession;
    if (!currentNode || current.pendingEditorEffect || session.kind === 'closed') return;

    if (session.kind === 'adding-file') {
      if (!session.selectedFile) return;
      startEffect({ kind: 'upload-resource', nodeId: currentNode.id, file: session.selectedFile });
      return;
    }
    if (!session.value.title.trim()) return;
    if (session.kind === 'adding-link') {
      if (!session.value.url.trim()) return;
      startEffect({
        kind: 'add-resource',
        nodeId: currentNode.id,
        resource: { ...session.value, type: 'LINK' },
      });
      return;
    }
    const resource = currentNode.resources.find((candidate) => candidate.id === session.resourceId);
    if (!resource || !resourceSessionIsDirtyForNode(currentNode, session)) return;
    startEffect({
      kind: 'update-resource',
      resourceId: session.resourceId,
      resource: session.value,
    });
  }, [startEffect]);

  const changeNodeDraft = useCallback(
    (value: ReturnType<typeof createNodeEditorState>['nodeDraft']) =>
      transition({ type: 'change-node-draft', value }),
    [transition],
  );
  const changeResource = useCallback(
    (value: ResourceInput) => transition({ type: 'change-resource', value }),
    [transition],
  );
  const openResource = useCallback(
    (mode: 'file' | 'link') => transition({ type: 'open-resource', mode }),
    [transition],
  );
  const editResource = useCallback(
    (resource: Resource) => transition({ type: 'edit-resource', resource }),
    [transition],
  );
  const changeResourceMode = useCallback(
    (mode: 'file' | 'link') => transition({ type: 'change-resource-mode', mode }),
    [transition],
  );
  const selectResourceFile = useCallback(
    (file: File | null) => transition({ type: 'select-resource-file', file }),
    [transition],
  );
  const closeResource = useCallback(() => transition({ type: 'close-resource' }), [transition]);

  const requestResourceDeletion = useCallback(
    (resource: Resource) => transition({ type: 'request-resource-deletion', resource }),
    [transition],
  );
  const cancelResourceDeletion = useCallback(
    () => transition({ type: 'cancel-resource-deletion' }),
    [transition],
  );
  const handleResourceDeletionAction = useCallback(
    (actionId: string) => {
      const current = stateRef.current;
      const resource = current.pendingResourceDeletion;
      if (
        actionId !== roadmapConfirmationActionIds.deleteResource ||
        !resource ||
        current.pendingEditorEffect
      )
        return;
      startEffect({ kind: 'delete-resource', resourceId: resource.id });
    },
    [startEffect],
  );

  const toggleVisibility = useCallback(() => {
    const currentNode = stateRef.current.canonicalNode;
    if (currentNode) {
      onIntent({
        kind: 'change-visibility',
        nodeId: currentNode.id,
        isVisible: currentNode.isVisible,
      });
    }
  }, [onIntent]);
  const requestTeacherBlock = useCallback(
    (operation: TeacherBlockOperation) => {
      const currentNode = stateRef.current.canonicalNode;
      if (currentNode)
        onIntent({ kind: 'change-teacher-block', nodeId: currentNode.id, operation });
    },
    [onIntent],
  );
  const closeNode = useCallback(() => {
    const currentNode = stateRef.current.canonicalNode;
    if (!currentNode) return;
    void guardDraft({ kind: 'deselect-node', nodeId: currentNode.id }).then((proceed) => {
      if (proceed) onIntent({ kind: 'close', nodeId: currentNode.id });
    });
  }, [guardDraft, onIntent]);
  const requestNodeDeletion = useCallback(() => {
    const currentNode = stateRef.current.canonicalNode;
    if (!currentNode) return;
    void guardDraft({ kind: 'delete-node', nodeId: currentNode.id }).then((proceed) => {
      if (proceed) onIntent({ kind: 'delete-node', nodeId: currentNode.id });
    });
  }, [guardDraft, onIntent]);
  const previewNodeInformation = useCallback(() => {
    const current = stateRef.current;
    if (!current.canonicalNode) return;
    onIntent({
      kind: 'preview-node-information',
      node: projectNodeInformationPreview(
        current.canonicalNode,
        current.nodeDraft,
        current.resourceSession,
      ),
      returnFocus: () => previewButtonRef.current?.focus(),
    });
  }, [onIntent]);

  useEffect(() => {
    if (!command || command.nodeId !== state.nodeId || handledCommandIdRef.current === command.id)
      return;
    handledCommandIdRef.current = command.id;
    transition({ type: 'consume-command', command });
    const frame = requestAnimationFrame(() => {
      (
        document.getElementById('resource-file') ?? document.getElementById('resource-title')
      )?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [command, state.nodeId, transition]);

  const contextValue = useMemo(() => {
    const activeNode = state.nodeId === (node?.id ?? null) ? state.canonicalNode : null;
    if (!activeNode) return null;
    return {
      node: activeNode,
      nodeTypes,
      nodeDraft: state.nodeDraft,
      resourceSession: state.resourceSession,
      isDirty: nodeEditorStateIsDirty(state),
      isNodeDirty: nodeDraftIsDirty(activeNode, state.nodeDraft),
      canSaveNode:
        !state.pendingEditorEffect &&
        nodeDraftIsDirty(activeNode, state.nodeDraft) &&
        Boolean(state.nodeDraft.title.trim()),
      isVisibilityPending,
      pendingEditorEffect: state.pendingEditorEffect,
      pendingResourceDeletion: state.pendingResourceDeletion,
      previewButtonRef,
      changeNodeDraft,
      changeResource,
      openResource,
      editResource,
      changeResourceMode,
      selectResourceFile,
      closeResource,
      saveNode,
      saveResource,
      requestResourceDeletion,
      cancelResourceDeletion,
      toggleVisibility,
      requestTeacherBlock,
      requestNodeDeletion,
      closeNode,
      previewNodeInformation,
    };
  }, [
    changeNodeDraft,
    changeResource,
    closeNode,
    closeResource,
    editResource,
    isVisibilityPending,
    node,
    nodeTypes,
    openResource,
    previewNodeInformation,
    requestNodeDeletion,
    requestResourceDeletion,
    cancelResourceDeletion,
    requestTeacherBlock,
    saveNode,
    saveResource,
    selectResourceFile,
    state,
    toggleVisibility,
    changeResourceMode,
  ]);

  const confirmGuard = useCallback(
    (actionId: string) => {
      if (
        actionId !== roadmapConfirmationActionIds.discardEditorDraft ||
        !stateRef.current.pendingGuard
      )
        return;
      const resolve = guardResolverRef.current;
      guardResolverRef.current = null;
      transition({ type: 'confirm-guard' });
      resolve?.(true);
    },
    [transition],
  );
  const cancelGuard = useCallback(() => {
    if (!stateRef.current.pendingGuard) return;
    const resolve = guardResolverRef.current;
    guardResolverRef.current = null;
    transition({ type: 'cancel-guard' });
    resolve?.(false);
  }, [transition]);

  const resourceDeletionPendingActionId =
    state.pendingEditorEffect?.effect.kind === 'delete-resource'
      ? roadmapConfirmationActionIds.deleteResource
      : undefined;

  return (
    <>
      {contextValue ? (
        <NodeEditorProvider value={contextValue}>
          <NodeDetailsEditor />
        </NodeEditorProvider>
      ) : null}
      <ConfirmationDialog
        confirmation={
          state.pendingGuard ? editorDraftDiscardConfirmation(state.pendingGuard) : null
        }
        onCancel={cancelGuard}
        onAction={confirmGuard}
      />
      <ConfirmationDialog
        confirmation={
          state.pendingResourceDeletion
            ? resourceDeletionConfirmation(state.pendingResourceDeletion)
            : null
        }
        pendingActionId={resourceDeletionPendingActionId}
        onCancel={cancelResourceDeletion}
        onAction={handleResourceDeletionAction}
      />
    </>
  );
});
