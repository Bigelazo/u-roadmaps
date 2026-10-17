import { describe, expect, it } from 'vitest';
import { noticeTargetDescriptors } from '@/features/notifications/application/notice-targets';
import { isNoticeVisible } from '@/features/notifications/application/notice-visibility';

const nodes = [
  { id: 'open', isVisible: true, nodeTypeId: 'type' },
  { id: 'blocked', isVisible: true, nodeTypeId: 'type' },
  { id: 'hidden', isVisible: false, nodeTypeId: 'hidden-type' },
];
const accessible = new Set(['open']);

// An accessible Node, a Blocked node, a hidden Node and a missing Node.
const aboutNodes = ['open', 'blocked', 'hidden', 'missing'].map((nodeId) => ({ nodeId }));
// Both endpoints visible (one Blocked), a hidden endpoint, a missing endpoint.
const aboutDependencies = [
  ['open', 'blocked'],
  ['open', 'hidden'],
  ['missing', 'open'],
].map(([sourceNodeId, targetNodeId]) => ({ sourceNodeId, targetNodeId }));
// A type with a visible (Blocked) Node, a type with only hidden Nodes, an unused type.
const aboutNodeTypes = ['type', 'hidden-type', 'unused-type'].map((nodeTypeId) => ({
  nodeTypeId,
}));

// ADR-0014 decision 10, per Notice target: whether each stored notice above is shown.
const SHOWN: Record<string, [Record<string, string>[], boolean[]]> = {
  'node-title': [aboutNodes, [true, true, false, false]],
  'node-type': [aboutNodes, [true, true, false, false]],
  'node-creation': [aboutNodes, [true, true, false, false]],
  'node-description': [aboutNodes, [true, false, false, false]],
  resource: [aboutNodes, [true, false, false, false]],
  'node-access': [aboutNodes, [true, true, true, true]],
  'node-deletion': [aboutNodes, [true, true, true, true]],
  'roadmap-availability': [[{}], [true]],
  dependency: [aboutDependencies, [true, false, false]],
  'node-type-name': [aboutNodeTypes, [true, false, false]],
};

describe('who a Notice target is shown to', () => {
  it.each(Object.entries(SHOWN))('%s', (noticeTarget, [stored, shown]) => {
    expect(
      stored.map((data) => isNoticeVisible({ noticeTarget, ...data }, nodes, accessible)),
    ).toEqual(shown);
  });

  it('covers every Notice target', () => {
    expect(Object.keys(SHOWN).sort()).toEqual(
      noticeTargetDescriptors.map(({ noticeTarget }) => noticeTarget).sort(),
    );
  });

  it('never decides by the legacy changeKind or changedFields', () => {
    const legacy = { changeKind: 'node-deleted', changedFields: ['title'] };
    expect(
      isNoticeVisible(
        { ...legacy, noticeTarget: 'resource', nodeId: 'blocked' },
        nodes,
        accessible,
      ),
    ).toBe(false);
  });

  // Legacy rows may carry a description, a Resource title or a hidden Node's title.
  it('shows a row no descriptor owns only on a Node the recipient can open', () => {
    const legacy = { changeKind: 'node-deleted', changedFields: ['description'] };
    expect(
      aboutNodes.map((data) => isNoticeVisible({ ...legacy, ...data }, nodes, accessible)),
    ).toEqual([true, false, false, false]);
    // Without a Node, it is shown as stored.
    expect(isNoticeVisible(legacy, nodes, accessible)).toBe(true);
  });
});
