'use client';

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useReducer,
  useRef,
} from 'react';
import {
  editorDraftDiscardConfirmation,
  nodeEditorConfirmationActionIds,
  resourceDeletionConfirmation,
} from '@/features/roadmap/ui/roadmap-confirmation';
import { Alert, AlertDescription } from '@/shared/ui/alert';
import { Button } from '@/shared/ui/button';
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog';
import type {
  Resource,
  RoadmapNode,
  StudentAccessibleRoadmapNode,
  TeacherBlockOperation,
} from '@/features/roadmap/types';
import { NodeDetailsEditor } from './NodeDetailsEditor';
import { NodeEditorProvider } from './context';
import {
  createNodeEditorState,
  nodeDraftIsDirty,
  nodeEditorReducer,
  nodeEditorStateIsDirty,
  nodeUpdateFromNode,
  resourceSessionIsDirty,
  type NodeEditorAction,
  type NodeEditorState,
} from './session';
import type {
  NodeEditorEffect,
  NodeEditorGuardReason,
  NodeEditorHandle,
  NodeEditorProps,
  NodeEditorPerformResult,
  NodeUpdate,
  ResourceInput,
  ResourceSession,
} from './types';

function isGuardRelevant(reason: NodeEditorGuardReason, nodeId: string | null) {
  if (!nodeId) return false;
  if (reason.kind === 'enter-canvas-preview') return true;
  if (reason.kind === 'replace-node' || reason.kind === 'open-resource') {
    return reason.nodeId !== nodeId;
  }
  return reason.nodeId === nodeId;
}

function unsavedNodeFields(node: RoadmapNode, draft: NodeUpdate) {
  const saved = nodeUpdateFromNode(node);
  return (['title', 'description', 'nodeTypeId'] as const).filter(
    (field) => draft[field] !== saved[field],
  );
}

function isCommitted(result: NodeEditorPerformResult) {
  return result.status === 'committed';
}

function projectNodeInformationPreview(
  node: RoadmapNode,
  nodeValue: NodeUpdate,
  resourceSession: ResourceSession,
): StudentAccessibleRoadmapNode {
  let resources = node.resources;

  if (resourceSessionIsDirty(node, resourceSession)) {
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

function useNodeEditorController(
  { session, command, perform, onIntent }: NodeEditorProps,
  ref: React.ForwardedRef<NodeEditorHandle>,
) {
  const { node, nodeTypes, isVisibilityPending } = session;
  const [state, dispatch] = useReducer(nodeEditorReducer, node, createNodeEditorState);
  const stateRef = useRef(state);
  const mountedRef = useRef(true);
  const guardResolverRef = useRef<((proceed: boolean) => void) | null>(null);
  const effectIdRef = useRef(0);
  const handledCommandIdRef = useRef<string | null>(null);
  const previewButtonRef = useRef<HTMLButtonElement | null>(null);

  useLayoutEffect(() => {
    stateRef.current = state;
  }, [state]);

  const settleGuard = useCallback((proceed: boolean) => {
    const resolve = guardResolverRef.current;
    guardResolverRef.current = null;
    resolve?.(proceed);
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      settleGuard(false);
    };
  }, [settleGuard]);

  const transition = useCallback((action: NodeEditorAction) => {
    stateRef.current = nodeEditorReducer(stateRef.current, action);
    dispatch(action);
  }, []);

  useEffect(() => {
    if (!node && nodeEditorStateIsDirty(stateRef.current)) {
      transition({ type: 'canonical-refresh', node });
    } else if ((node?.id ?? null) !== stateRef.current.nodeId) {
      if (stateRef.current.pendingGuard) settleGuard(false);
      transition({ type: 'replace-node', node });
    } else if (node) {
      transition({ type: 'canonical-refresh', node });
    }
  }, [node, settleGuard, transition]);

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

  useImperativeHandle(
    ref,
    () => ({ guardDraft, hasDraft: () => nodeEditorStateIsDirty(stateRef.current) }),
    [guardDraft],
  );

  const startEffect = useCallback(
    (effect: NodeEditorEffect) => {
      const current = stateRef.current;
      if (current.pendingEditorEffect || current.remoteConflict || !current.nodeId) return;

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
    if (!resource || !resourceSessionIsDirty(currentNode, session)) return;
    startEffect({
      kind: 'update-resource',
      resourceId: session.resourceId,
      resource: session.value,
    });
  }, [startEffect]);

  const transitions = useMemo(
    () => ({
      changeNodeDraft: (value: NodeUpdate) => transition({ type: 'change-node-draft', value }),
      changeResource: (value: ResourceInput) => transition({ type: 'change-resource', value }),
      openResource: (mode: 'file' | 'link') => transition({ type: 'open-resource', mode }),
      editResource: (resource: Resource) => transition({ type: 'edit-resource', resource }),
      changeResourceMode: (mode: 'file' | 'link') =>
        transition({ type: 'change-resource-mode', mode }),
      selectResourceFile: (file: File | null) => transition({ type: 'select-resource-file', file }),
      closeResource: () => transition({ type: 'close-resource' }),
      requestResourceDeletion: (resource: Resource) =>
        transition({ type: 'request-resource-deletion', resource }),
      cancelResourceDeletion: () => transition({ type: 'cancel-resource-deletion' }),
      resolveRemoteConflict: () => transition({ type: 'resolve-remote-conflict' }),
      discardNodeDraft: () => {
        const currentNode = stateRef.current.canonicalNode;
        if (currentNode)
          transition({ type: 'change-node-draft', value: nodeUpdateFromNode(currentNode) });
      },
      cancelGuard: () => {
        if (!stateRef.current.pendingGuard) return;
        transition({ type: 'cancel-guard' });
        settleGuard(false);
      },
    }),
    [settleGuard, transition],
  );

  const handleResourceDeletionAction = useCallback(
    (actionId: string) => {
      const current = stateRef.current;
      const resource = current.pendingResourceDeletion;
      if (
        actionId !== nodeEditorConfirmationActionIds.deleteResource ||
        !resource ||
        current.pendingEditorEffect
      )
        return;
      startEffect({ kind: 'delete-resource', resourceId: resource.id });
    },
    [startEffect],
  );

  const intents = useMemo(() => {
    const withCurrentNode =
      <Args extends unknown[]>(run: (node: RoadmapNode, ...args: Args) => void) =>
      (...args: Args) => {
        const currentNode = stateRef.current.canonicalNode;
        if (currentNode) run(currentNode, ...args);
      };

    return {
      toggleVisibility: withCurrentNode((currentNode) =>
        onIntent({
          kind: currentNode.isVisible ? 'hide-node' : 'show-node',
          nodeId: currentNode.id,
        }),
      ),
      requestTeacherBlock: withCurrentNode((currentNode, operation: TeacherBlockOperation) =>
        onIntent({ kind: 'change-teacher-block', nodeId: currentNode.id, operation }),
      ),
      scheduleTeacherUnlock: withCurrentNode((currentNode, unlockOn: string | null) =>
        onIntent({ kind: 'schedule-teacher-unlock', nodeId: currentNode.id, unlockOn }),
      ),
      // A dirty draft must be discarded before the editor closes this Node.
      closeNode: withCurrentNode((currentNode) => {
        void guardDraft({ kind: 'deselect-node', nodeId: currentNode.id }).then((proceed) => {
          if (proceed) onIntent({ kind: 'close', nodeId: currentNode.id });
        });
      }),
      // The canvas commands ask about the draft before a deletion opens.
      requestNodeDeletion: withCurrentNode((currentNode) =>
        onIntent({ kind: 'delete-node', nodeId: currentNode.id }),
      ),
    };
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

  const hasDraft = nodeEditorStateIsDirty(state);
  useEffect(() => {
    if (!hasDraft) return;
    // Closing or reloading the tab would otherwise drop the draft without the editor's guard.
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasDraft]);

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
    const activeNode =
      state.nodeId === (node?.id ?? null) || state.remoteDeleted ? state.canonicalNode : null;
    if (!activeNode) return null;
    return {
      node: activeNode,
      nodeTypes,
      nodeDraft: state.nodeDraft,
      resourceSession: state.resourceSession,
      isDirty: nodeEditorStateIsDirty(state),
      unsavedFields: unsavedNodeFields(activeNode, state.nodeDraft),
      // An empty title stays submittable so the form can explain why it cannot be saved.
      canSaveNode:
        !state.remoteConflict &&
        !state.pendingEditorEffect &&
        nodeDraftIsDirty(activeNode, state.nodeDraft),
      isVisibilityPending,
      pendingEditorEffect: state.pendingEditorEffect,
      previewButtonRef,
      ...transitions,
      ...intents,
      saveNode,
      saveResource,
      previewNodeInformation,
    };
  }, [
    intents,
    isVisibilityPending,
    node,
    nodeTypes,
    previewNodeInformation,
    saveNode,
    saveResource,
    state,
    transitions,
  ]);

  const confirmGuard = useCallback(
    (actionId: string) => {
      if (
        actionId !== nodeEditorConfirmationActionIds.discardEditorDraft ||
        !stateRef.current.pendingGuard
      )
        return;
      transition({ type: 'confirm-guard' });
      settleGuard(true);
    },
    [settleGuard, transition],
  );

  return { state, transitions, handleResourceDeletionAction, contextValue, confirmGuard };
}

export const NodeEditor = forwardRef<NodeEditorHandle, NodeEditorProps>(
  function NodeEditor(props, ref) {
    const { state, transitions, handleResourceDeletionAction, contextValue, confirmGuard } =
      useNodeEditorController(props, ref);

    return (
      <>
        <NodeEditorConflictNotice state={state} onResolve={transitions.resolveRemoteConflict} />
        {contextValue ? (
          <NodeEditorProvider value={contextValue}>
            <NodeDetailsEditor />
          </NodeEditorProvider>
        ) : null}{' '}
        <ConfirmationDialog
          confirmation={
            state.pendingGuard ? editorDraftDiscardConfirmation(state.pendingGuard) : null
          }
          onCancel={transitions.cancelGuard}
          onAction={confirmGuard}
        />
        <ConfirmationDialog
          confirmation={
            state.pendingResourceDeletion
              ? resourceDeletionConfirmation(state.pendingResourceDeletion)
              : null
          }
          pendingActionId={
            state.pendingEditorEffect?.effect.kind === 'delete-resource'
              ? nodeEditorConfirmationActionIds.deleteResource
              : undefined
          }
          onCancel={transitions.cancelResourceDeletion}
          onAction={handleResourceDeletionAction}
        />
      </>
    );
  },
);

function NodeEditorConflictNotice({
  state,
  onResolve,
}: {
  state: NodeEditorState;
  onResolve: () => void;
}) {
  return state.remoteConflict ? (
    <Alert role="status">
      <AlertDescription>
        {state.remoteDeleted
          ? 'Este Nodo fue eliminado. Conservamos tu borrador local; no se puede guardar.'
          : 'El Nodo cambió mientras editabas. Conservamos tu borrador local. Revisa la versión actual antes de guardar.'}
        {!state.remoteDeleted ? (
          <Button type="button" variant="outline" onClick={onResolve}>
            Conservar mi borrador sobre la versión actual
          </Button>
        ) : null}
      </AlertDescription>
    </Alert>
  ) : null;
}
