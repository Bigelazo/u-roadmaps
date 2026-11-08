import { expect, it } from 'vitest';
import {
  createNodeEditorState,
  nodeEditorReducer,
  type NodeEditorAction,
  type NodeEditorState,
} from '@/features/roadmap/editor/session';
import type { RoadmapNode } from '@/features/roadmap/types';

const node: RoadmapNode = {
  id: 'node-1',
  title: 'Límites',
  positionX: 0,
  positionY: 0,
  nodeTypeId: 'type-1',
  description: null,
  resources: [],
  isVisible: true,
  isTeacherBlocked: false,
};
const link = {
  title: 'Guía',
  url: 'https://example.com/guia',
  type: 'LINK' as const,
};

function run(actions: NodeEditorAction[], state = createNodeEditorState(node)) {
  return actions.reduce<NodeEditorState>(nodeEditorReducer, state);
}

function addingLink() {
  const state = run([
    { type: 'open-resource', mode: 'link' },
    { type: 'change-resource', value: link },
  ]);
  return run(
    [
      {
        type: 'start-effect',
        pending: {
          id: 1,
          epoch: state.epoch,
          effect: { kind: 'add-resource', nodeId: node.id, resource: link },
        },
      },
    ],
    state,
  );
}

it('closes the Resource form when its own result is refreshed before the effect resolves', () => {
  const pending = addingLink();
  const refreshed = run(
    [
      {
        type: 'canonical-refresh',
        node: { ...node, resources: [{ id: 'resource-1', ...link, fileContentType: null }] },
      },
      { type: 'resolve-effect', effectId: 1, epoch: pending.epoch, status: 'committed' },
    ],
    pending,
  );
  expect(refreshed.remoteConflict).toBe(false);
  expect(refreshed.resourceSession.kind).toBe('closed');
});

it('reports a remote conflict when an unrelated change is refreshed during the effect', () => {
  const pending = addingLink();
  const refreshed = run(
    [{ type: 'canonical-refresh', node: { ...node, title: 'Derivadas' } }],
    pending,
  );
  expect(refreshed.remoteConflict).toBe(true);
});

it('treats its own refreshed file replacement as the pending result, not a remote conflict', () => {
  const stored = {
    id: 'resource-1',
    title: 'Guía.docx',
    url: '/api/protected/resource-1/file',
    type: 'FILE' as const,
    fileContentType: 'application/msword',
  };
  const withFile = { ...node, resources: [stored] };
  const replacement = new File(['pdf'], 'guia.pdf', { type: 'application/pdf' });
  const editing = run(
    [
      { type: 'edit-resource', resource: stored },
      { type: 'select-resource-file', file: replacement },
    ],
    createNodeEditorState(withFile),
  );
  expect(editing.resourceSession).toMatchObject({
    replacementFile: replacement,
    value: { title: 'Guía.pdf' },
  });
  const { title, url, type } = stored;
  const pending = run(
    [
      {
        type: 'start-effect',
        pending: {
          id: 1,
          epoch: editing.epoch,
          effect: {
            kind: 'update-resource',
            resourceId: stored.id,
            resource: { title: 'Guía.pdf', url, type },
            file: replacement,
          },
        },
      },
    ],
    editing,
  );
  const refreshed = run(
    [
      {
        type: 'canonical-refresh',
        node: {
          ...withFile,
          resources: [{ ...stored, title: 'Guía.pdf', fileContentType: 'application/pdf' }],
        },
      },
      { type: 'resolve-effect', effectId: 1, epoch: pending.epoch, status: 'committed' },
    ],
    pending,
  );
  expect(refreshed.remoteConflict).toBe(false);
  expect(refreshed.resourceSession.kind).toBe('closed');
  expect(
    run([{ type: 'select-resource-file', file: null }], editing).resourceSession,
  ).toMatchObject({ replacementFile: null, value: { title } });
});
