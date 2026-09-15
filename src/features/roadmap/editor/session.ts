import type { RoadmapNode, Resource } from '@/features/roadmap/types';
import type {
  NodeEditorEffect,
  NodeEditorGuardReason,
  NodeEditorCommand,
  NodeUpdate,
  ResourceInput,
  ResourceSession,
} from './types';

export type PendingEditorEffect = {
  id: number;
  epoch: number;
  effect: NodeEditorEffect;
};

export type NodeEditorState = {
  epoch: number;
  nodeId: string | null;
  canonicalNode: RoadmapNode | null;
  nodeDraft: NodeUpdate;
  resourceSession: ResourceSession;
  pendingEditorEffect: PendingEditorEffect | null;
  pendingResourceDeletion: Resource | null;
  pendingGuard: NodeEditorGuardReason | null;
  consumedCommandIds: readonly string[];
};

export type NodeEditorAction =
  | { type: 'replace-node'; node: RoadmapNode | undefined }
  | { type: 'canonical-refresh'; node: RoadmapNode | undefined }
  | { type: 'change-node-draft'; value: NodeUpdate }
  | { type: 'open-resource'; mode: 'file' | 'link' }
  | { type: 'edit-resource'; resource: Resource }
  | { type: 'change-resource'; value: ResourceInput }
  | { type: 'change-resource-mode'; mode: 'file' | 'link' }
  | { type: 'select-resource-file'; file: File | null }
  | { type: 'close-resource' }
  | { type: 'consume-command'; command: NodeEditorCommand }
  | { type: 'request-resource-deletion'; resource: Resource }
  | { type: 'cancel-resource-deletion' }
  | { type: 'request-guard'; reason: NodeEditorGuardReason }
  | { type: 'confirm-guard' }
  | { type: 'cancel-guard' }
  | { type: 'start-effect'; pending: PendingEditorEffect }
  | {
      type: 'resolve-effect';
      effectId: number;
      epoch: number;
      status: 'committed' | 'rejected';
    };

export const emptyNodeUpdate: NodeUpdate = {
  title: '',
  description: '',
  nodeTypeId: '',
};

export const emptyResourceInput: ResourceInput = {
  title: '',
  url: '',
  type: 'LINK',
};

export function nodeUpdateFromNode(node: RoadmapNode | undefined): NodeUpdate {
  return node
    ? {
        title: node.title,
        description: node.description ?? '',
        nodeTypeId: node.nodeTypeId,
      }
    : emptyNodeUpdate;
}

export function resourceInputFromResource(resource: Resource): ResourceInput {
  return { title: resource.title, url: resource.url, type: resource.type };
}

export function emptyResourceSession(): ResourceSession {
  return { kind: 'closed' };
}

function sameResourceInput(first: ResourceInput, second: ResourceInput) {
  return first.title === second.title && first.url === second.url && first.type === second.type;
}

function resourceSessionIsDirty(node: RoadmapNode, session: ResourceSession) {
  switch (session.kind) {
    case 'closed':
      return false;
    case 'adding-file':
      return Boolean(
        session.selectedFile || session.value.title.trim() || session.value.url.trim(),
      );
    case 'adding-link':
      return Boolean(session.value.title.trim() || session.value.url.trim());
    case 'editing-existing': {
      const resource = node.resources.find((candidate) => candidate.id === session.resourceId);
      return !resource || !sameResourceInput(session.value, resourceInputFromResource(resource));
    }
  }
}

export function nodeDraftIsDirty(node: RoadmapNode, value: NodeUpdate) {
  return (
    value.title !== node.title ||
    value.description !== (node.description ?? '') ||
    value.nodeTypeId !== node.nodeTypeId
  );
}

export function nodeEditorStateIsDirty(state: NodeEditorState) {
  return Boolean(
    state.canonicalNode &&
    (nodeDraftIsDirty(state.canonicalNode, state.nodeDraft) ||
      resourceSessionIsDirty(state.canonicalNode, state.resourceSession)),
  );
}

export function resourceSessionIsDirtyForNode(node: RoadmapNode, session: ResourceSession) {
  return resourceSessionIsDirty(node, session);
}

function resourceSessionMatchesEffect(session: ResourceSession, effect: NodeEditorEffect) {
  switch (effect.kind) {
    case 'add-resource':
      return session.kind === 'adding-link' && sameResourceInput(session.value, effect.resource);
    case 'upload-resource':
      return session.kind === 'adding-file' && session.selectedFile === effect.file;
    case 'update-resource':
      return (
        session.kind === 'editing-existing' &&
        session.resourceId === effect.resourceId &&
        sameResourceInput(session.value, effect.resource)
      );
    case 'update-node':
    case 'delete-resource':
      return false;
  }
}

function replaceNodeInformation(node: RoadmapNode, value: NodeUpdate): RoadmapNode {
  return {
    ...node,
    title: value.title,
    description: value.description || null,
    nodeTypeId: value.nodeTypeId,
  };
}

function createState(
  node: RoadmapNode | undefined,
  epoch: number,
  consumedCommandIds: readonly string[] = [],
): NodeEditorState {
  return {
    epoch,
    nodeId: node?.id ?? null,
    canonicalNode: node ?? null,
    nodeDraft: nodeUpdateFromNode(node),
    resourceSession: emptyResourceSession(),
    pendingEditorEffect: null,
    pendingResourceDeletion: null,
    pendingGuard: null,
    consumedCommandIds,
  };
}

export function createNodeEditorState(node: RoadmapNode | undefined) {
  return createState(node, 0);
}

export function nodeEditorReducer(
  state: NodeEditorState,
  action: NodeEditorAction,
): NodeEditorState {
  switch (action.type) {
    case 'replace-node':
      return createState(action.node, state.epoch + 1, state.consumedCommandIds);
    case 'canonical-refresh': {
      if ((action.node?.id ?? null) !== state.nodeId) return state;
      if (!action.node) return state;
      if (nodeEditorStateIsDirty(state)) {
        return { ...state, epoch: state.epoch + 1, canonicalNode: action.node };
      }
      return {
        ...state,
        epoch: state.epoch + 1,
        canonicalNode: action.node,
        nodeDraft: nodeUpdateFromNode(action.node),
        resourceSession: emptyResourceSession(),
      };
    }
    case 'change-node-draft':
      return { ...state, epoch: state.epoch + 1, nodeDraft: action.value };
    case 'open-resource':
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession:
          action.mode === 'file'
            ? { kind: 'adding-file', value: emptyResourceInput, selectedFile: null }
            : { kind: 'adding-link', value: emptyResourceInput },
      };
    case 'edit-resource':
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession: {
          kind: 'editing-existing',
          resourceId: action.resource.id,
          value: resourceInputFromResource(action.resource),
        },
      };
    case 'change-resource':
      if (state.resourceSession.kind === 'closed') return state;
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession: { ...state.resourceSession, value: action.value },
      };
    case 'change-resource-mode':
      if (state.resourceSession.kind === 'adding-file' && action.mode === 'link') {
        return {
          ...state,
          epoch: state.epoch + 1,
          resourceSession: { kind: 'adding-link', value: state.resourceSession.value },
        };
      }
      if (state.resourceSession.kind === 'adding-link' && action.mode === 'file') {
        return {
          ...state,
          epoch: state.epoch + 1,
          resourceSession: {
            kind: 'adding-file',
            value: state.resourceSession.value,
            selectedFile: null,
          },
        };
      }
      return state;
    case 'select-resource-file':
      if (state.resourceSession.kind !== 'adding-file') return state;
      if (state.resourceSession.selectedFile === action.file) return state;
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession: { ...state.resourceSession, selectedFile: action.file },
      };
    case 'close-resource':
      if (state.resourceSession.kind === 'closed') return state;
      return { ...state, epoch: state.epoch + 1, resourceSession: emptyResourceSession() };
    case 'consume-command':
      if (
        state.consumedCommandIds.includes(action.command.id) ||
        state.nodeId !== action.command.nodeId
      )
        return state;
      return {
        ...state,
        ...(state.resourceSession.kind === 'closed' ? { epoch: state.epoch + 1 } : {}),
        consumedCommandIds: [...state.consumedCommandIds, action.command.id],
        resourceSession:
          state.resourceSession.kind === 'closed'
            ? action.command.mode === 'file'
              ? { kind: 'adding-file', value: emptyResourceInput, selectedFile: null }
              : { kind: 'adding-link', value: emptyResourceInput }
            : state.resourceSession,
      };
    case 'request-resource-deletion':
      if (state.pendingEditorEffect) return state;
      return { ...state, pendingResourceDeletion: action.resource };
    case 'cancel-resource-deletion':
      if (state.pendingEditorEffect?.effect.kind === 'delete-resource') return state;
      return { ...state, pendingResourceDeletion: null };
    case 'request-guard':
      return state.pendingGuard ? state : { ...state, pendingGuard: action.reason };
    case 'confirm-guard':
      return {
        ...createState(state.canonicalNode ?? undefined, state.epoch + 1, state.consumedCommandIds),
        pendingGuard: null,
      };
    case 'cancel-guard':
      return { ...state, pendingGuard: null };
    case 'start-effect':
      if (state.pendingEditorEffect || action.pending.epoch !== state.epoch) return state;
      return { ...state, pendingEditorEffect: action.pending };
    case 'resolve-effect': {
      const pending = state.pendingEditorEffect;
      if (!pending || pending.id !== action.effectId || pending.epoch !== action.epoch)
        return state;

      const next = { ...state, pendingEditorEffect: null };
      if (pending.epoch !== state.epoch || action.status === 'rejected') return next;

      switch (pending.effect.kind) {
        case 'update-node': {
          const canonicalNode =
            state.canonicalNode?.id === pending.effect.nodeId
              ? replaceNodeInformation(state.canonicalNode, pending.effect.value)
              : state.canonicalNode;
          return { ...next, canonicalNode };
        }
        case 'add-resource':
        case 'upload-resource':
        case 'update-resource':
          return resourceSessionMatchesEffect(state.resourceSession, pending.effect)
            ? { ...next, resourceSession: emptyResourceSession() }
            : next;
        case 'delete-resource':
          return state.pendingResourceDeletion?.id === pending.effect.resourceId
            ? { ...next, pendingResourceDeletion: null }
            : next;
      }
    }
  }
}
