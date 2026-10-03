import { expect, test } from 'vitest';
import { dependencyChangeNotifications } from '@/features/roadmap/application/dependency-change-notifications';
import { projectAccessSnapshot } from '@/features/roadmap/application/node-change-notifications';

const nodes = [
  {
    id: 'prerequisite',
    title: 'Leyes de Newton',
    nodeType: { name: 'Contenido' },
    isVisible: true,
    isTeacherBlocked: false,
  },
  {
    id: 'target',
    title: 'Evaluación 1',
    nodeType: { name: 'Evaluación' },
    isVisible: true,
    isTeacherBlocked: false,
  },
  {
    id: 'next',
    title: 'Evaluación 2',
    nodeType: { name: 'Evaluación' },
    isVisible: true,
    isTeacherBlocked: false,
  },
  {
    id: 'outside',
    title: 'Álgebra',
    nodeType: { name: 'Contenido' },
    isVisible: true,
    isTeacherBlocked: false,
  },
];

const participants = [
  { userId: 'author', role: 'TEACHER' as const, isActive: true },
  { userId: 'active-teacher', role: 'TEACHER' as const, isActive: true },
  { userId: 'completed-student', role: 'STUDENT' as const, isActive: true },
  { userId: 'pending-student', role: 'STUDENT' as const, isActive: true },
  { userId: 'inactive-student', role: 'STUDENT' as const, isActive: false },
];

test('adding a visible Dependency sends the route notice and only real access transitions', () => {
  const before = projectAccessSnapshot({
    nodes,
    dependencies: [{ sourceNodeId: 'target', targetNodeId: 'next' }],
    participants,
    completions: [
      { userId: 'completed-student', roadmapNodeId: 'prerequisite' },
      { userId: 'completed-student', roadmapNodeId: 'target' },
      { userId: 'pending-student', roadmapNodeId: 'target' },
    ],
  });
  const after = projectAccessSnapshot({
    nodes,
    dependencies: [
      { sourceNodeId: 'prerequisite', targetNodeId: 'target' },
      { sourceNodeId: 'target', targetNodeId: 'next' },
    ],
    participants,
    completions: [
      { userId: 'completed-student', roadmapNodeId: 'prerequisite' },
      { userId: 'completed-student', roadmapNodeId: 'target' },
      { userId: 'pending-student', roadmapNodeId: 'target' },
    ],
  });

  expect(
    dependencyChangeNotifications({
      before,
      after,
      actorId: 'author',
      dependencyId: 'dependency-id',
      roadmapId: 'roadmap',
      changeKind: 'dependency-added',
      sourceNode: { title: 'Leyes de Newton', isVisible: true },
      targetNode: { title: 'Evaluación 1', isVisible: true },
    }),
  ).toEqual({
    path: {
      eventId: 'dependency-id:dependency-added',
      dependencyId: 'dependency-id',
      roadmapId: 'roadmap',
      changeKind: 'dependency-added',
      dependentNodeTitle: 'Evaluación 1',
      prerequisiteNodeTitle: 'Leyes de Newton',
      recipientIds: ['active-teacher', 'completed-student', 'pending-student'],
    },
    nodes: [
      {
        eventId: 'dependency-id:dependency-added:target:node-blocked',
        nodeId: 'target',
        roadmapId: 'roadmap',
        changeKind: 'node-blocked',
        nodeTitle: 'Evaluación 1',
        nodeTypeName: 'Evaluación',
        targetKind: 'roadmap',
        recipientIds: ['pending-student'],
      },
      {
        eventId: 'dependency-id:dependency-added:next:node-blocked',
        nodeId: 'next',
        roadmapId: 'roadmap',
        changeKind: 'node-blocked',
        nodeTitle: 'Evaluación 2',
        nodeTypeName: 'Evaluación',
        targetKind: 'roadmap',
        recipientIds: ['pending-student'],
      },
    ],
  });
});

test('removing one prerequisite does not announce access while another prerequisite remains pending', () => {
  const dependencies = [
    { sourceNodeId: 'prerequisite', targetNodeId: 'target' },
    { sourceNodeId: 'outside', targetNodeId: 'target' },
    { sourceNodeId: 'target', targetNodeId: 'next' },
  ];
  const before = projectAccessSnapshot({ nodes, dependencies, participants, completions: [] });
  const after = projectAccessSnapshot({
    nodes,
    dependencies: dependencies.filter(({ sourceNodeId }) => sourceNodeId !== 'prerequisite'),
    participants,
    completions: [],
  });

  const result = dependencyChangeNotifications({
    before,
    after,
    actorId: 'author',
    dependencyId: 'dependency-id',
    roadmapId: 'roadmap',
    changeKind: 'dependency-removed',
    sourceNode: { title: 'Leyes de Newton', isVisible: true },
    targetNode: { title: 'Evaluación 1', isVisible: true },
  });

  expect(result.path).toMatchObject({
    changeKind: 'dependency-removed',
    dependentNodeTitle: 'Evaluación 1',
    prerequisiteNodeTitle: 'Leyes de Newton',
  });
  expect(result.nodes).toEqual([]);
});

test('hidden endpoint changes do not create a route notice', () => {
  const snapshot = projectAccessSnapshot({
    nodes,
    dependencies: [],
    participants,
    completions: [],
  });

  const result = dependencyChangeNotifications({
    before: snapshot,
    after: snapshot,
    actorId: 'author',
    dependencyId: 'dependency-id',
    roadmapId: 'roadmap',
    changeKind: 'dependency-added',
    sourceNode: { title: 'Leyes de Newton', isVisible: false },
    targetNode: { title: 'Evaluación 1', isVisible: true },
  });

  expect(result.path).toBeUndefined();
  expect(result.nodes).toEqual([]);
});
