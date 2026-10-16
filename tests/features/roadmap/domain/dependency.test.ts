import { expect, test } from 'vitest';
import { decideDependency } from '@/features/roadmap/domain/dependency';

function node(id: string, overrides: { isVisible?: boolean; isTeacherBlocked?: boolean } = {}) {
  return { id, title: id, isVisible: true, isTeacherBlocked: false, ...overrides };
}

test('rejects a Dependency from a Node to itself', () => {
  expect(
    decideDependency({
      nodes: [node('intro')],
      dependencies: [],
      sourceNodeId: 'intro',
      targetNodeId: 'intro',
    }),
  ).toEqual({
    kind: 'REJECTED',
    reason: 'SELF_DEPENDENCY',
    message: 'Un nodo no puede depender de sí mismo.',
  });
});

test('rejects a Dependency to a Node outside the Roadmap', () => {
  expect(
    decideDependency({
      nodes: [node('intro')],
      dependencies: [],
      sourceNodeId: 'intro',
      targetNodeId: 'missing',
    }),
  ).toEqual({
    kind: 'REJECTED',
    reason: 'NODE_NOT_FOUND',
    message: 'El nodo no existe en este roadmap.',
  });
});

test('rejects a Dependency that involves a hidden Node', () => {
  const nodes = [node('intro'), node('draft', { isVisible: false })];

  for (const [sourceNodeId, targetNodeId] of [
    ['intro', 'draft'],
    ['draft', 'intro'],
  ])
    expect(decideDependency({ nodes, dependencies: [], sourceNodeId, targetNodeId })).toEqual({
      kind: 'REJECTED',
      reason: 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
      message: 'No se pueden crear dependencias con nodos ocultos.',
    });
});

test('rejects a Dependency that already exists', () => {
  expect(
    decideDependency({
      nodes: [node('intro'), node('theory')],
      dependencies: [{ sourceNodeId: 'intro', targetNodeId: 'theory' }],
      sourceNodeId: 'intro',
      targetNodeId: 'theory',
    }),
  ).toEqual({
    kind: 'REJECTED',
    reason: 'DEPENDENCY_CONFLICT',
    message: 'La dependencia ya existe.',
  });
});

test('rejects a Dependency that would close a cycle', () => {
  expect(
    decideDependency({
      nodes: [node('intro'), node('theory'), node('assessment')],
      dependencies: [
        { sourceNodeId: 'intro', targetNodeId: 'theory' },
        { sourceNodeId: 'theory', targetNodeId: 'assessment' },
      ],
      sourceNodeId: 'assessment',
      targetNodeId: 'intro',
    }),
  ).toEqual({
    kind: 'REJECTED',
    reason: 'DEPENDENCY_CYCLE',
    message: 'La dependencia formaría un ciclo.',
  });
});

test('blocks the target and its visible dependents when the source keeps a Teacher block', () => {
  const nodes = [
    { ...node('intro', { isTeacherBlocked: true }), title: 'Introducción' },
    { ...node('theory'), title: 'Teoría' },
    { ...node('exercises'), title: 'Ejercicios' },
    { ...node('quiz', { isTeacherBlocked: true }), title: 'Control' },
    { ...node('draft', { isVisible: false }), title: 'Borrador' },
  ];
  const dependencies = [
    { sourceNodeId: 'theory', targetNodeId: 'exercises' },
    { sourceNodeId: 'theory', targetNodeId: 'quiz' },
  ];

  expect(
    decideDependency({ nodes, dependencies, sourceNodeId: 'intro', targetNodeId: 'theory' }),
  ).toEqual({
    kind: 'ALLOWED',
    teacherBlockedNodes: [
      { id: 'exercises', title: 'Ejercicios' },
      { id: 'theory', title: 'Teoría' },
    ],
  });
});

test('blocks nothing when the source has no Teacher block', () => {
  expect(
    decideDependency({
      nodes: [node('intro'), node('theory')],
      dependencies: [],
      sourceNodeId: 'intro',
      targetNodeId: 'theory',
    }),
  ).toEqual({ kind: 'ALLOWED', teacherBlockedNodes: [] });
});
