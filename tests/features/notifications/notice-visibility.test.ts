import { describe, expect, it } from 'vitest';
import { isNoticeVisible } from '@/features/notifications/application/notice-visibility';

const nodes = [{ id: 'node', isVisible: true }];

describe('pending Notice target visibility', () => {
  it('hides description and Resource notices while blocked, then restores them', () => {
    for (const data of [
      { nodeId: 'node', noticeTarget: 'node-description' },
      { nodeId: 'node', changeKind: 'resource-updated' },
    ]) {
      expect(isNoticeVisible(data, nodes, new Set())).toBe(false);
      expect(isNoticeVisible(data, nodes, new Set(['node']))).toBe(true);
    }
  });
});

it('hides every content target of a hidden Node, but keeps Roadmap withdrawal and deletion notices', () => {
  const hidden = [{ id: 'node', isVisible: false }];
  for (const noticeTarget of ['node-title', 'node-type', 'node-description', 'resource']) {
    expect(isNoticeVisible({ nodeId: 'node', noticeTarget }, hidden, new Set())).toBe(false);
    expect(isNoticeVisible({ nodeId: 'node', noticeTarget }, nodes, new Set(['node']))).toBe(true);
  }
  expect(isNoticeVisible({ nodeId: 'node', noticeTarget: 'node-access' }, hidden, new Set())).toBe(
    true,
  );
  expect(isNoticeVisible({ nodeId: 'deleted', changeKind: 'node-deleted' }, nodes, new Set())).toBe(
    true,
  );
});

it('keeps title and type notices visible on blocked Nodes', () => {
  for (const noticeTarget of ['node-title', 'node-type'])
    expect(isNoticeVisible({ nodeId: 'node', noticeTarget }, nodes, new Set())).toBe(true);
});

it('requires both Dependency endpoints to remain visible, including removed edges', () => {
  const endpoints = [
    { id: 'source', isVisible: true },
    { id: 'target', isVisible: true },
  ];
  for (const changeKind of ['dependency-added', 'dependency-removed']) {
    const data = {
      noticeTarget: 'dependency',
      changeKind,
      sourceNodeId: 'source',
      targetNodeId: 'target',
    };
    expect(isNoticeVisible(data, endpoints, new Set())).toBe(true);
    for (const hiddenId of ['source', 'target']) {
      const hidden = endpoints.map((node) => ({ ...node, isVisible: node.id !== hiddenId }));
      expect(isNoticeVisible(data, hidden, new Set())).toBe(false);
    }
    expect(isNoticeVisible(data, endpoints.slice(0, 1), new Set())).toBe(false);
  }
});

it('requires at least one visible Node of the renamed type, even if blocked', () => {
  const data = {
    noticeTarget: 'node-type-name',
    changeKind: 'classification-updated',
    nodeTypeId: 'type',
  };
  const typedNodes = [
    { id: 'one', nodeTypeId: 'type', isVisible: false },
    { id: 'two', nodeTypeId: 'type', isVisible: true },
    { id: 'other', nodeTypeId: 'other-type', isVisible: true },
  ];
  expect(isNoticeVisible(data, typedNodes, new Set())).toBe(true);
  expect(
    isNoticeVisible(
      data,
      typedNodes.map((node) => ({ ...node, isVisible: node.nodeTypeId !== 'type' })),
      new Set(),
    ),
  ).toBe(false);
  expect(isNoticeVisible(data, [], new Set())).toBe(false);
});
