import type { RoadmapNode, Resource } from '@/features/roadmap/types';
import type {
  NodeEditorEffect,
  NodeEditorGuardReason,
  NodeEditorCommand,
  NodeUpdate,
  ResourceInput,
  ResourceSession,
} from './types';

type PendingEditorEffect = {
  id: number;
  epoch: number;
  effect: NodeEditorEffect;
};

export type NodeEditorState = {
  epoch: number;
  remoteConflict: boolean;
  remoteDeleted: boolean;
  nodeId: string | null;
  canonicalNode: RoadmapNode | null;
  nodeDraft: NodeUpdate;
  resourceSession: ResourceSession;
  pendingEditorEffect: PendingEditorEffect | null;
  confirmedEditorEffect: NodeEditorEffect | null;
  pendingResourceDeletion: Resource | null;
  pendingGuard: NodeEditorGuardReason | null;
  consumedCommandIds: readonly string[];
};

export type NodeEditorAction =
  | { type: 'resolve-remote-conflict' }
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

const emptyNodeUpdate: NodeUpdate = {
  title: '',
  description: '',
  nodeTypeId: '',
};

const emptyResourceInput: ResourceInput = {
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

function resourceInputFromResource(resource: Resource): ResourceInput {
  return { title: resource.title, url: resource.url, type: resource.type };
}

const closedResourceSession: ResourceSession = { kind: 'closed' };

function addingResourceSession(mode: 'file' | 'link', value = emptyResourceInput): ResourceSession {
  return mode === 'file'
    ? { kind: 'adding-file', value, selectedFile: null }
    : { kind: 'adding-link', value };
}

function sameResourceInput(first: ResourceInput, second: ResourceInput) {
  return first.title === second.title && first.url === second.url && first.type === second.type;
}

/** Field-by-field and order-sensitive: the same Resources in the same order. */
function sameResources(first: readonly Resource[], second: readonly Resource[]) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function resourceSessionIsDirty(node: RoadmapNode, session: ResourceSession) {
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
    remoteConflict: false,
    remoteDeleted: false,
    nodeId: node?.id ?? null,
    canonicalNode: node ?? null,
    nodeDraft: nodeUpdateFromNode(node),
    resourceSession: closedResourceSession,
    pendingEditorEffect: null,
    confirmedEditorEffect: null,
    pendingResourceDeletion: null,
    pendingGuard: null,
    consumedCommandIds,
  };
}

export function createNodeEditorState(node: RoadmapNode | undefined) {
  return createState(node, 0);
}

function refreshMatchesPendingEffect(state: NodeEditorState, next: RoadmapNode) {
  const previous = state.canonicalNode;
  const effect = state.pendingEditorEffect?.effect ?? state.confirmedEditorEffect;
  if (
    !previous ||
    !effect ||
    previous.isVisible !== next.isVisible ||
    previous.isTeacherBlocked !== next.isTeacherBlocked
  )
    return false;
  if (effect.kind === 'update-node') {
    return (
      !nodeDraftIsDirty(next, effect.value) && sameResources(previous.resources, next.resources)
    );
  }
  if (nodeDraftIsDirty(previous, nodeUpdateFromNode(next))) return false;
  switch (effect.kind) {
    case 'update-resource':
      return sameResources(
        next.resources,
        previous.resources.map((resource) =>
          resource.id === effect.resourceId ? { ...resource, ...effect.resource } : resource,
        ),
      );
    case 'delete-resource':
      return sameResources(
        next.resources,
        previous.resources.filter((resource) => resource.id !== effect.resourceId),
      );
    case 'add-resource':
    case 'upload-resource': {
      const added = next.resources.filter(
        (resource) => !previous.resources.some(({ id }) => id === resource.id),
      );
      const retained = next.resources.filter((resource) =>
        previous.resources.some(({ id }) => id === resource.id),
      );
      return (
        sameResources(retained, previous.resources) &&
        added.length === 1 &&
        (effect.kind === 'add-resource'
          ? sameResourceInput(added[0], effect.resource)
          : added[0].type === 'FILE' && added[0].title === effect.file.name)
      );
    }
  }
}

export function nodeEditorReducer(
  state: NodeEditorState,
  action: NodeEditorAction,
): NodeEditorState {
  switch (action.type) {
    case 'replace-node':
      return createState(action.node, state.epoch + 1, state.consumedCommandIds);
    case 'resolve-remote-conflict':
      return state.remoteDeleted ? state : { ...state, remoteConflict: false };
    case 'canonical-refresh': {
      if (!action.node) return { ...state, remoteConflict: true, remoteDeleted: true };
      if (action.node.id !== state.nodeId) return state;
      if (nodeEditorStateIsDirty(state)) {
        const previous = state.canonicalNode;
        const changed =
          previous &&
          (nodeDraftIsDirty(previous, nodeUpdateFromNode(action.node)) ||
            previous.isVisible !== action.node.isVisible ||
            previous.isTeacherBlocked !== action.node.isTeacherBlocked ||
            !sameResources(previous.resources, action.node.resources));
        const isPendingEffectResult = refreshMatchesPendingEffect(state, action.node);
        // The result of the pending effect, arriving before it resolves, keeps that
        // effect current so it can still close its Resource form.
        const keepsPendingEffectCurrent = Boolean(
          changed && state.pendingEditorEffect && isPendingEffectResult,
        );
        return {
          ...state,
          epoch: keepsPendingEffectCurrent ? state.epoch : state.epoch + 1,
          canonicalNode: action.node,
          remoteConflict: state.remoteConflict || Boolean(changed && !isPendingEffectResult),
          remoteDeleted: false,
          confirmedEditorEffect: null,
        };
      }
      return {
        ...state,
        epoch: state.epoch + 1,
        canonicalNode: action.node,
        nodeDraft: nodeUpdateFromNode(action.node),
        resourceSession: closedResourceSession,
        confirmedEditorEffect: null,
      };
    }
    case 'change-node-draft':
      return { ...state, epoch: state.epoch + 1, nodeDraft: action.value };
    case 'open-resource':
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession: addingResourceSession(action.mode),
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
    case 'change-resource-mode': {
      const session = state.resourceSession;
      if (
        (session.kind !== 'adding-file' && session.kind !== 'adding-link') ||
        session.kind === `adding-${action.mode}`
      )
        return state;
      return {
        ...state,
        epoch: state.epoch + 1,
        resourceSession: addingResourceSession(action.mode, session.value),
      };
    }
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
      return { ...state, epoch: state.epoch + 1, resourceSession: closedResourceSession };
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
            ? addingResourceSession(
                action.command.mode,
                action.command.mode === 'file' ? emptyResourceInput : action.command.value,
              )
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

      const next = {
        ...state,
        pendingEditorEffect: null,
        confirmedEditorEffect:
          action.status === 'committed' ? pending.effect : state.confirmedEditorEffect,
      };
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
            ? { ...next, resourceSession: closedResourceSession }
            : next;
        case 'delete-resource':
          return state.pendingResourceDeletion?.id === pending.effect.resourceId
            ? { ...next, pendingResourceDeletion: null }
            : next;
      }
    }
  }
}
