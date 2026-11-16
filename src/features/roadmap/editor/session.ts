import type { RoadmapNode, Resource } from '@/features/roadmap/types';
import { replaceFileTitleExtension, uploadedContentType } from '@/features/roadmap/domain/resource';
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
      return (
        !resource ||
        Boolean(session.replacementFile) ||
        !sameResourceInput(session.value, resourceInputFromResource(resource))
      );
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
        session.replacementFile === (effect.file ?? null) &&
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

function updatedResource(
  resource: Resource,
  effect: Extract<NodeEditorEffect, { kind: 'update-resource' }>,
  next: RoadmapNode,
): Resource {
  if (!effect.file) return { ...resource, ...effect.resource };
  const replaced = next.resources.find(({ id }) => id === resource.id);
  return {
    ...resource,
    title: effect.resource.title,
    url: replaced?.url ?? resource.url,
    fileContentType: uploadedContentType(effect.file),
    fileSize: effect.file.size,
  };
}

function withReplacementFile(
  state: NodeEditorState,
  session: Extract<ResourceSession, { kind: 'editing-existing' }>,
  file: File | null,
): ResourceSession {
  const resource = state.canonicalNode?.resources.find(({ id }) => id === session.resourceId);
  if (!resource || resource.type !== 'FILE') return session;
  const previousName = session.replacementFile?.name ?? resource.title;
  return {
    ...session,
    replacementFile: file,
    value: {
      ...session.value,
      title: replaceFileTitleExtension(
        session.value.title,
        previousName,
        file?.name ?? resource.title,
      ),
    },
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
          resource.id === effect.resourceId ? updatedResource(resource, effect, next) : resource,
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

function advanced(state: NodeEditorState, changes: Partial<NodeEditorState>): NodeEditorState {
  return { ...state, ...changes, epoch: state.epoch + 1 };
}

function canonicalNodeChanged(previous: RoadmapNode | null, next: RoadmapNode) {
  return Boolean(
    previous &&
    (nodeDraftIsDirty(previous, nodeUpdateFromNode(next)) ||
      previous.isVisible !== next.isVisible ||
      previous.isTeacherBlocked !== next.isTeacherBlocked ||
      !sameResources(previous.resources, next.resources)),
  );
}

function refreshDirtyEditor(state: NodeEditorState, node: RoadmapNode): NodeEditorState {
  const changed = canonicalNodeChanged(state.canonicalNode, node);
  const isPendingEffectResult = refreshMatchesPendingEffect(state, node);
  const keepsPendingEffectCurrent =
    changed && Boolean(state.pendingEditorEffect) && isPendingEffectResult;
  return {
    ...state,
    epoch: keepsPendingEffectCurrent ? state.epoch : state.epoch + 1,
    canonicalNode: node,
    remoteConflict: state.remoteConflict || (changed && !isPendingEffectResult),
    remoteDeleted: false,
    confirmedEditorEffect: null,
  };
}

function refreshCanonicalNode(
  state: NodeEditorState,
  node: RoadmapNode | undefined,
): NodeEditorState {
  if (!node) return { ...state, remoteConflict: true, remoteDeleted: true };
  if (node.id !== state.nodeId) return state;
  if (nodeEditorStateIsDirty(state)) return refreshDirtyEditor(state, node);
  return advanced(state, {
    canonicalNode: node,
    nodeDraft: nodeUpdateFromNode(node),
    resourceSession: closedResourceSession,
    confirmedEditorEffect: null,
  });
}

function changeResourceMode(state: NodeEditorState, mode: 'file' | 'link'): NodeEditorState {
  const session = state.resourceSession;
  if (session.kind !== 'adding-file' && session.kind !== 'adding-link') return state;
  if (session.kind === `adding-${mode}`) return state;
  return advanced(state, { resourceSession: addingResourceSession(mode, session.value) });
}

function selectResourceFile(state: NodeEditorState, file: File | null): NodeEditorState {
  const session = state.resourceSession;
  if (session.kind === 'editing-existing') {
    if (session.replacementFile === file) return state;
    const resourceSession = withReplacementFile(state, session, file);
    return resourceSession === session ? state : advanced(state, { resourceSession });
  }
  if (session.kind !== 'adding-file' || session.selectedFile === file) return state;
  return advanced(state, { resourceSession: { ...session, selectedFile: file } });
}

function consumeCommand(state: NodeEditorState, command: NodeEditorCommand): NodeEditorState {
  if (state.consumedCommandIds.includes(command.id) || state.nodeId !== command.nodeId)
    return state;
  const consumedCommandIds = [...state.consumedCommandIds, command.id];
  if (state.resourceSession.kind !== 'closed') return { ...state, consumedCommandIds };
  return advanced(state, {
    consumedCommandIds,
    resourceSession: addingResourceSession(
      command.mode,
      command.mode === 'file' ? emptyResourceInput : command.value,
    ),
  });
}

function settleCommittedEffect(
  state: NodeEditorState,
  next: NodeEditorState,
  effect: NodeEditorEffect,
): NodeEditorState {
  switch (effect.kind) {
    case 'update-node':
      return state.canonicalNode?.id === effect.nodeId
        ? { ...next, canonicalNode: replaceNodeInformation(state.canonicalNode, effect.value) }
        : next;
    case 'add-resource':
    case 'upload-resource':
    case 'update-resource':
      return resourceSessionMatchesEffect(state.resourceSession, effect)
        ? { ...next, resourceSession: closedResourceSession }
        : next;
    case 'delete-resource':
      return state.pendingResourceDeletion?.id === effect.resourceId
        ? { ...next, pendingResourceDeletion: null }
        : next;
  }
}

function resolveEffect(
  state: NodeEditorState,
  { effectId, epoch, status }: ActionOf<'resolve-effect'>,
): NodeEditorState {
  const pending = state.pendingEditorEffect;
  if (!pending || pending.id !== effectId || pending.epoch !== epoch) return state;
  const committed = status === 'committed';
  const next = {
    ...state,
    pendingEditorEffect: null,
    confirmedEditorEffect: committed ? pending.effect : state.confirmedEditorEffect,
  };
  if (pending.epoch !== state.epoch || !committed) return next;
  return settleCommittedEffect(state, next, pending.effect);
}

type ActionOf<Type extends NodeEditorAction['type']> = Extract<NodeEditorAction, { type: Type }>;

type NodeEditorHandlers = {
  [Type in NodeEditorAction['type']]: (
    state: NodeEditorState,
    action: ActionOf<Type>,
  ) => NodeEditorState;
};

const nodeEditorHandlers: NodeEditorHandlers = {
  'replace-node': (state, { node }) => createState(node, state.epoch + 1, state.consumedCommandIds),
  'resolve-remote-conflict': (state) =>
    state.remoteDeleted ? state : { ...state, remoteConflict: false },
  'canonical-refresh': (state, { node }) => refreshCanonicalNode(state, node),
  'change-node-draft': (state, { value }) => advanced(state, { nodeDraft: value }),
  'open-resource': (state, { mode }) =>
    advanced(state, { resourceSession: addingResourceSession(mode) }),
  'edit-resource': (state, { resource }) =>
    advanced(state, {
      resourceSession: {
        kind: 'editing-existing',
        resourceId: resource.id,
        value: resourceInputFromResource(resource),
        replacementFile: null,
      },
    }),
  'change-resource': (state, { value }) =>
    state.resourceSession.kind === 'closed'
      ? state
      : advanced(state, { resourceSession: { ...state.resourceSession, value } }),
  'change-resource-mode': (state, { mode }) => changeResourceMode(state, mode),
  'select-resource-file': (state, { file }) => selectResourceFile(state, file),
  'close-resource': (state) =>
    state.resourceSession.kind === 'closed'
      ? state
      : advanced(state, { resourceSession: closedResourceSession }),
  'consume-command': (state, { command }) => consumeCommand(state, command),
  'request-resource-deletion': (state, { resource }) =>
    state.pendingEditorEffect ? state : { ...state, pendingResourceDeletion: resource },
  'cancel-resource-deletion': (state) =>
    state.pendingEditorEffect?.effect.kind === 'delete-resource'
      ? state
      : { ...state, pendingResourceDeletion: null },
  'request-guard': (state, { reason }) =>
    state.pendingGuard ? state : { ...state, pendingGuard: reason },
  'confirm-guard': (state) => ({
    ...createState(state.canonicalNode ?? undefined, state.epoch + 1, state.consumedCommandIds),
    pendingGuard: null,
  }),
  'cancel-guard': (state) => ({ ...state, pendingGuard: null }),
  'start-effect': (state, { pending }) =>
    state.pendingEditorEffect || pending.epoch !== state.epoch
      ? state
      : { ...state, pendingEditorEffect: pending },
  'resolve-effect': resolveEffect,
};

export function nodeEditorReducer(
  state: NodeEditorState,
  action: NodeEditorAction,
): NodeEditorState {
  const handle = nodeEditorHandlers[action.type] as (
    state: NodeEditorState,
    action: NodeEditorAction,
  ) => NodeEditorState;
  return handle(state, action);
}
