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
