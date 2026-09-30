import { expect, test } from 'vitest';
import {
  visibilityNotifications,
  type AccessSnapshot,
} from '@/features/roadmap/application/node-change-notifications';

const participants = [{ userId: 'teacher' }, { userId: 'student-a' }, { userId: 'student-b' }];
const node = (id: string, isVisible = true) => ({
  id,
  title: id === 'target' ? 'Evaluación final' : 'Unidad siguiente',
  nodeType: { name: id === 'target' ? 'Evaluación' : 'Unidad' },
  isVisible,
  isTeacherBlocked: false,
});
const snapshot = (
  nodes: AccessSnapshot['nodes'],
  access: Record<string, string[]>,
): AccessSnapshot => ({
  nodes,
  participants,
  accessibleByUser: new Map(
    Object.entries(access).map(([userId, ids]) => [userId, new Set(ids)]),
  ),
});

test('publishing a hidden Node retains its title and targets only newly accessible participants', () => {
  const notices = visibilityNotifications({
    before: snapshot([node('target', false)], { teacher: [], 'student-a': [], 'student-b': [] }),
    after: snapshot([node('target')], { teacher: ['target'], 'student-a': ['target'], 'student-b': [] }),
    actorId: 'teacher',
    targetNodeId: 'target',
    targetChange: 'node-available',
    roadmapId: 'roadmap',
  });

  expect(notices).toEqual([
    {
      nodeId: 'target',
      roadmapId: 'roadmap',
      changeKind: 'node-available',
      nodeTitle: 'Evaluación final',
      nodeTypeName: 'Evaluación',
      targetKind: 'node',
      recipientIds: ['student-a'],
    },
  ]);
});

test.each(['node-retired', 'node-deleted'] as const)(
  '%s retains the previous Node details and reaches the previous audience',
  (changeKind) => {
    const notices = visibilityNotifications({
      before: snapshot([node('target')], { teacher: ['target'], 'student-a': ['target'], 'student-b': [] }),
      after: snapshot([], { teacher: [], 'student-a': [], 'student-b': [] }),
      actorId: 'teacher',
      targetNodeId: 'target',
      targetChange: changeKind,
      roadmapId: 'roadmap',
    });

    expect(notices).toEqual([
      {
        nodeId: 'target',
        roadmapId: 'roadmap',
        changeKind,
        nodeTitle: 'Evaluación final',
        nodeTypeName: 'Evaluación',
        targetKind: 'roadmap',
        recipientIds: ['student-a', 'student-b'],
      },
    ]);
  },
);

test('hidden edits produce no target notice and dependency changes notify surviving Nodes per audience', () => {
  const notices = visibilityNotifications({
    before: snapshot([node('target', false), node('survivor')], {
      teacher: ['survivor'],
      'student-a': ['survivor'],
      'student-b': [],
    }),
    after: snapshot([node('target', false), node('survivor')], {
      teacher: ['survivor'],
      'student-a': [],
      'student-b': ['survivor'],
    }),
    actorId: 'teacher',
    targetNodeId: 'target',
    roadmapId: 'roadmap',
  });

  expect(notices).toEqual([
    {
      nodeId: 'survivor',
      roadmapId: 'roadmap',
      changeKind: 'node-available',
      nodeTitle: 'Unidad siguiente',
      nodeTypeName: 'Unidad',
      targetKind: 'node',
      recipientIds: ['student-b'],
    },
    {
      nodeId: 'survivor',
      roadmapId: 'roadmap',
      changeKind: 'node-blocked',
      nodeTitle: 'Unidad siguiente',
      nodeTypeName: 'Unidad',
      targetKind: 'roadmap',
      recipientIds: ['student-a'],
    },
  ]);
});
