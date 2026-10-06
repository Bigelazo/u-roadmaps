import { expect, test } from 'vitest';
import {
  accessTransitionNotifications,
  projectAccessSnapshot,
  visibilityNotifications,
  type AccessSnapshot,
} from '@/features/roadmap/application/node-change-notifications';
import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
} from '@/features/roadmap/domain/access';

const participants = [{ userId: 'teacher' }, { userId: 'student-a' }, { userId: 'student-b' }];
const node = (id: string, isVisible = true, isTeacherBlocked = false) => ({
  id,
  title: id === 'target' ? 'Evaluación final' : 'Unidad siguiente',
  nodeType: { name: id === 'target' ? 'Evaluación' : 'Unidad' },
  isVisible,
  isTeacherBlocked,
});
const snapshot = (
  nodes: AccessSnapshot['nodes'],
  access: Record<string, string[]>,
): AccessSnapshot => ({
  nodes,
  participants,
  accessibleByUser: new Map(Object.entries(access).map(([userId, ids]) => [userId, new Set(ids)])),
});

test('block notices follow each active Participation access projection across a branch', () => {
  const nodes = [
    node('start'),
    node('root'),
    node('left'),
    node('right'),
    node('join'),
    node('outside'),
  ];
  const dependencies = [
    { sourceNodeId: 'start', targetNodeId: 'root' },
    { sourceNodeId: 'root', targetNodeId: 'left' },
    { sourceNodeId: 'root', targetNodeId: 'right' },
    { sourceNodeId: 'left', targetNodeId: 'join' },
    { sourceNodeId: 'right', targetNodeId: 'join' },
    { sourceNodeId: 'outside', targetNodeId: 'join' },
  ];
  const participants = [
    { userId: 'author', role: 'TEACHER' as const, isActive: true },
    { userId: 'other-teacher', role: 'TEACHER' as const, isActive: true },
    { userId: 'student-complete', role: 'STUDENT' as const, isActive: true },
    { userId: 'student-pending', role: 'STUDENT' as const, isActive: true },
    { userId: 'inactive-student', role: 'STUDENT' as const, isActive: false },
  ];
  const completedNodes = ['start', 'root', 'left', 'right', 'join', 'outside'];
  const completions = [
    ...completedNodes.map((roadmapNodeId) => ({
      userId: 'student-complete',
      roadmapNodeId,
    })),
    ...completedNodes.map((roadmapNodeId) => ({
      userId: 'inactive-student',
      roadmapNodeId,
    })),
  ];
  const before = projectAccessSnapshot({
    nodes,
    dependencies,
    participants,
    completions,
  });
  expect(before.participants).not.toContainEqual({ userId: 'inactive-student' });
  const branchNodeIds = new Set(['root', ...transitiveDependentNodeIds(dependencies, 'root')]);
  const after = projectAccessSnapshot({
    nodes: nodes.map((item) => ({ ...item, isTeacherBlocked: branchNodeIds.has(item.id) })),
    dependencies,
    participants,
    completions,
  });

  expect(
    accessTransitionNotifications({ before, after, actorId: 'author', roadmapId: 'roadmap' }),
  ).toEqual(
    ['root', 'left', 'right', 'join'].map((nodeId) => ({
      nodeId,
      roadmapId: 'roadmap',
      changeKind: 'node-blocked',
      previousAccess: 'Disponible',
      nodeTitle: 'Unidad siguiente',
      nodeTypeName: 'Unidad',
      targetKind: 'roadmap',
      recipientIds: ['other-teacher', 'student-complete'],
    })),
  );
});

test('unlock notices only reach participants whose access returns, with Completions retained', () => {
  const nodes = [node('start'), node('root', true, true), node('dependent', true, true)];
  const dependencies = [
    { sourceNodeId: 'start', targetNodeId: 'root' },
    { sourceNodeId: 'root', targetNodeId: 'dependent' },
  ];
  const participants = [
    { userId: 'author', role: 'TEACHER' as const, isActive: true },
    { userId: 'other-teacher', role: 'TEACHER' as const, isActive: true },
    { userId: 'student-complete', role: 'STUDENT' as const, isActive: true },
    { userId: 'student-pending', role: 'STUDENT' as const, isActive: true },
    { userId: 'inactive-student', role: 'STUDENT' as const, isActive: false },
  ];
  const completions = ['start', 'root', 'dependent'].map((roadmapNodeId) => ({
    userId: 'student-complete',
    roadmapNodeId,
  }));
  const before = projectAccessSnapshot({
    nodes,
    dependencies,
    participants,
    completions,
  });
  const after = projectAccessSnapshot({
    nodes: nodes.map((item) => ({ ...item, isTeacherBlocked: false })),
    dependencies,
    participants,
    completions,
  });

  expect(
    accessTransitionNotifications({ before, after, actorId: 'author', roadmapId: 'roadmap' }),
  ).toEqual(
    ['root', 'dependent'].map((nodeId) => ({
      nodeId,
      roadmapId: 'roadmap',
      changeKind: 'node-available',
      previousAccess: 'Bloqueado',
      nodeTitle: 'Unidad siguiente',
      nodeTypeName: 'Unidad',
      targetKind: 'node',
      recipientIds: ['other-teacher', 'student-complete'],
    })),
  );
  expect([...(before.accessibleByUser.get('student-complete') ?? [])]).not.toContain('root');
  expect([...(after.accessibleByUser.get('student-complete') ?? [])]).toContain('dependent');
});

test('unlocking a Node does not announce availability while a student prerequisite remains pending', () => {
  const nodes = [node('prerequisite'), node('selected', true, true)];
  const dependencies = [{ sourceNodeId: 'prerequisite', targetNodeId: 'selected' }];
  const participants = [
    { userId: 'author', role: 'TEACHER' as const, isActive: true },
    { userId: 'other-teacher', role: 'TEACHER' as const, isActive: true },
    { userId: 'student-complete', role: 'STUDENT' as const, isActive: true },
    { userId: 'student-pending', role: 'STUDENT' as const, isActive: true },
    { userId: 'inactive-student', role: 'STUDENT' as const, isActive: false },
  ];
  const completions = [{ userId: 'student-complete', roadmapNodeId: 'prerequisite' }];
  const before = projectAccessSnapshot({
    nodes,
    dependencies,
    participants,
    completions,
  });
  const after = projectAccessSnapshot({
    nodes: nodes.map((item) => ({ ...item, isTeacherBlocked: false })),
    dependencies,
    participants,
    completions,
  });

  expect(
    accessTransitionNotifications({ before, after, actorId: 'author', roadmapId: 'roadmap' }),
  ).toEqual([
    {
      nodeId: 'selected',
      roadmapId: 'roadmap',
      changeKind: 'node-available',
      previousAccess: 'Bloqueado',
      nodeTitle: 'Unidad siguiente',
      nodeTypeName: 'Unidad',
      targetKind: 'node',
      recipientIds: ['other-teacher', 'student-complete'],
    },
  ]);
  expect(after.accessibleByUser.get('student-pending')?.has('selected')).toBe(false);
});

test('a branch unlock held by an external teacher-blocked prerequisite emits no access transitions', () => {
  const nodes = [
    node('outside', true, true),
    node('root', true, true),
    node('dependent', true, true),
  ];
  const dependencies = [
    { sourceNodeId: 'outside', targetNodeId: 'root' },
    { sourceNodeId: 'root', targetNodeId: 'dependent' },
  ];
  const eligibleNodeIds = eligibleBranchUnlockNodeIds({
    dependencies,
    teacherBlockedNodeIds: new Set(nodes.map(({ id }) => id)),
    rootNodeId: 'root',
  });
  const participants = [
    { userId: 'author', role: 'TEACHER' as const, isActive: true },
    { userId: 'student', role: 'STUDENT' as const, isActive: true },
    { userId: 'inactive-student', role: 'STUDENT' as const, isActive: false },
  ];
  const before = projectAccessSnapshot({
    nodes,
    dependencies,
    participants,
    completions: [],
  });
  const after = projectAccessSnapshot({
    nodes: nodes.map((item) => ({
      ...item,
      isTeacherBlocked: item.isTeacherBlocked && !eligibleNodeIds.has(item.id),
    })),
    dependencies,
    participants,
    completions: [],
  });

  expect(eligibleNodeIds).toEqual(new Set());
  expect(
    accessTransitionNotifications({ before, after, actorId: 'author', roadmapId: 'roadmap' }),
  ).toEqual([]);
});

test('publishing a hidden Node notifies both available and blocked states', () => {
  const notices = visibilityNotifications({
    before: snapshot([node('target', false)], { teacher: [], 'student-a': [], 'student-b': [] }),
    after: snapshot([node('target')], {
      teacher: ['target'],
      'student-a': ['target'],
      'student-b': [],
    }),
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
      previousAccess: 'Retirado',
      nodeTitle: 'Evaluación final',
      nodeTypeName: 'Evaluación',
      targetKind: 'node',
      recipientIds: ['student-a'],
    },
    {
      nodeId: 'target',
      roadmapId: 'roadmap',
      changeKind: 'node-blocked',
      previousAccess: 'Retirado',
      nodeTitle: 'Evaluación final',
      nodeTypeName: 'Evaluación',
      targetKind: 'roadmap',
      recipientIds: ['student-b'],
    },
  ]);
});

test.each(['node-deleted'] as const)(
  '%s retains the previous Node details and reaches the previous audience',
  (changeKind) => {
    const notices = visibilityNotifications({
      before: snapshot([node('target')], {
        teacher: ['target'],
        'student-a': ['target'],
        'student-b': [],
      }),
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

  expect(notices).toEqual(
    expect.arrayContaining([
      {
        nodeId: 'survivor',
        roadmapId: 'roadmap',
        changeKind: 'node-available',
        previousAccess: 'Bloqueado',
        nodeTitle: 'Unidad siguiente',
        nodeTypeName: 'Unidad',
        targetKind: 'node',
        recipientIds: ['student-b'],
      },
      {
        nodeId: 'survivor',
        roadmapId: 'roadmap',
        changeKind: 'node-blocked',
        previousAccess: 'Disponible',
        nodeTitle: 'Unidad siguiente',
        nodeTypeName: 'Unidad',
        targetKind: 'roadmap',
        recipientIds: ['student-a'],
      },
    ]),
  );
});
