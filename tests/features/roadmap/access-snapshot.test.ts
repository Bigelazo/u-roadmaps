// @vitest-environment node
import { expect, test } from 'vitest';
import { projectAccessSnapshot } from '@/features/roadmap/application/access-snapshot';
import { accessChanges } from '@/features/roadmap/application/access-changes';

const node = (id: string, state: { isVisible?: boolean; isTeacherBlocked?: boolean } = {}) => ({
  id,
  title: `Tema ${id}`,
  nodeType: { name: 'Tema' },
  isVisible: state.isVisible ?? true,
  isTeacherBlocked: state.isTeacherBlocked ?? false,
});

const nodes = [
  node('base'),
  node('listas'),
  node('arboles'),
  node('grafos', { isTeacherBlocked: true }),
  node('oculto', { isVisible: false }),
  node('heaps'),
];

const dependencies = [
  { sourceNodeId: 'base', targetNodeId: 'listas' },
  { sourceNodeId: 'listas', targetNodeId: 'arboles' },
  { sourceNodeId: 'arboles', targetNodeId: 'grafos' },
  { sourceNodeId: 'oculto', targetNodeId: 'heaps' },
];

const participants = [
  { userId: 'ana', role: 'STUDENT', isActive: true },
  { userId: 'beto', role: 'STUDENT', isActive: true },
  { userId: 'carla', role: 'STUDENT', isActive: true },
  { userId: 'diego', role: 'TEACHER', isActive: true },
  { userId: 'elena', role: 'STUDENT', isActive: false },
] as const;

const completions = [
  { userId: 'ana', roadmapNodeId: 'base' },
  { userId: 'ana', roadmapNodeId: 'listas' },
  { userId: 'beto', roadmapNodeId: 'base' },
  { userId: 'elena', roadmapNodeId: 'base' },
];

const accessible = (snapshot: ReturnType<typeof projectAccessSnapshot>) =>
  Object.fromEntries(
    [...snapshot.accessibleByUser].map(([userId, ids]) => [userId, [...ids].sort()]),
  );

test('each active participant gets the Nodes their own Completions open', () => {
  const snapshot = projectAccessSnapshot({ nodes, dependencies, participants, completions });
  expect(accessible(snapshot)).toEqual({
    ana: ['arboles', 'base', 'heaps', 'listas'],
    beto: ['base', 'heaps', 'listas'],
    carla: ['base', 'heaps'],
    diego: ['arboles', 'base', 'heaps', 'listas'],
  });
  expect(snapshot.participants).toEqual([
    { userId: 'ana', role: 'STUDENT' },
    { userId: 'beto', role: 'STUDENT' },
    { userId: 'carla', role: 'STUDENT' },
    { userId: 'diego', role: 'TEACHER' },
  ]);
});

test('a new prerequisite reports the Node access each participant lost', () => {
  const before = projectAccessSnapshot({ nodes, dependencies, participants, completions });
  const after = projectAccessSnapshot({
    nodes,
    dependencies: [...dependencies, { sourceNodeId: 'heaps', targetNodeId: 'listas' }],
    participants,
    completions,
  });
  expect(
    accessChanges(before, after).flatMap((fact) =>
      fact.kind === 'node-access'
        ? [
            {
              nodeId: fact.nodeId,
              recipientId: fact.recipientId,
              previous: fact.previous,
              current: fact.current,
            },
          ]
        : [],
    ),
  ).toEqual([
    { nodeId: 'listas', recipientId: 'ana', previous: 'Disponible', current: 'Bloqueado' },
    { nodeId: 'listas', recipientId: 'beto', previous: 'Disponible', current: 'Bloqueado' },
    { nodeId: 'arboles', recipientId: 'ana', previous: 'Disponible', current: 'Bloqueado' },
  ]);
});
