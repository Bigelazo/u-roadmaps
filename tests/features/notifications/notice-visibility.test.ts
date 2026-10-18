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

// ADR-0030 decision 3, per Notice target: whether each stored notice above is shown.
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

// ADR-0014 decision 10, «Equipo docente»: teaching staff are shown every Node change,
// whatever the Node's visibility or Teacher block; a missing Node, a Node type's name and
// Node access are as above.
const SHOWN_TO_TEACHING_STAFF: Record<string, boolean[]> = {
  'node-title': [true, true, true, false],
  'node-type': [true, true, true, false],
  'node-creation': [true, true, true, false],
  'node-description': [true, true, true, false],
  resource: [true, true, true, false],
  dependency: [true, true, false],
};

describe('who a Notice target is shown to', () => {
  it.each(Object.entries(SHOWN))('%s', (noticeTarget, [stored, shown]) => {
    expect(
      stored.map((data) =>
        isNoticeVisible({ noticeTarget, ...data }, nodes, accessible, 'STUDENT'),
      ),
    ).toEqual(shown);
  });

  it.each(Object.entries(SHOWN))('%s, to teaching staff', (noticeTarget, [stored, shown]) => {
    expect(
      stored.map((data) =>
        isNoticeVisible({ noticeTarget, ...data }, nodes, accessible, 'TEACHER'),
      ),
    ).toEqual(SHOWN_TO_TEACHING_STAFF[noticeTarget] ?? shown);
  });

  it('covers every Notice target', () => {
    expect(Object.keys(SHOWN).sort()).toEqual(
      noticeTargetDescriptors.map(({ noticeTarget }) => noticeTarget).sort(),
    );
  });

  it('never shows a row no descriptor owns', () => {
    for (const data of [...aboutNodes, {}])
      for (const role of ['STUDENT', 'TEACHER'] as const)
        expect(isNoticeVisible(data, nodes, accessible, role)).toBe(false);
  });
});
