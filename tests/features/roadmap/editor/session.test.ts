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
const link = { title: 'Guía', url: 'https://example.com/guia', type: 'LINK' as const };

function run(actions: NodeEditorAction[], state = createNodeEditorState(node)) {
  return actions.reduce<NodeEditorState>(nodeEditorReducer, state);
}

/** A Resource form adding `link`, whose effect is in flight. */
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
        node: { ...node, resources: [{ id: 'resource-1', ...link }] },
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
