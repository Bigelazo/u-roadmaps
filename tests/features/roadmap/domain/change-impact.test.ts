import { expect, test } from 'vitest';
import {
  confirmChange,
  decideChangeImpactVersion,
  planChange,
  type RoadmapSnapshot,
} from '@/features/roadmap/domain/change-impact';

type SnapshotNode = RoadmapSnapshot['nodes'][number];

function node(id: string, overrides: Partial<SnapshotNode> = {}): SnapshotNode {
  return {
    id,
    title: id,
    nodeTypeId: 'content',
    isVisible: true,
    isTeacherBlocked: false,
    resources: [],
    ...overrides,
  };
}

function roadmap(
  nodes: SnapshotNode[],
  dependencies: [source: string, target: string][] = [],
): RoadmapSnapshot {
  return {
    nodes,
    dependencies: dependencies.map(([sourceNodeId, targetNodeId]) => ({
      id: `${sourceNodeId}-${targetNodeId}`,
      sourceNodeId,
      targetNodeId,
    })),
    nodeTypes: [{ id: 'content', name: 'Contenido', icon: 'BookOpen', color: '#024AD8' }],
    today: '2026-11-03',
  };
}

function dependency(sourceNodeId: string, targetNodeId: string) {
  return { kind: 'create-dependency', sourceNodeId, targetNodeId } as const;
}

test('refuses a Dependency from a Node to itself', () => {
  expect(planChange(roadmap([node('intro')]), dependency('intro', 'intro'))).toEqual({
    kind: 'REJECTED',
    reason: 'SELF_DEPENDENCY',
    message: 'Un nodo no puede depender de sí mismo.',
  });
});

test.each([
  ['intro', 'missing'],
  ['missing', 'intro'],
])('refuses a Dependency from %s to %s when a Node is not in the Roadmap', (source, target) => {
  expect(planChange(roadmap([node('intro')]), dependency(source, target))).toEqual({
    kind: 'REJECTED',
    reason: 'NODE_NOT_FOUND',
    message: 'El nodo no existe en este roadmap.',
  });
});

test.each([
  ['intro', 'draft'],
  ['draft', 'intro'],
])('refuses a Dependency from %s to %s when a Node is hidden', (source, target) => {
  const snapshot = roadmap([node('intro'), node('draft', { isVisible: false })]);

  expect(planChange(snapshot, dependency(source, target))).toEqual({
    kind: 'REJECTED',
    reason: 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
    message: 'No se pueden crear dependencias con nodos ocultos.',
  });
});

test('refuses a Dependency that already exists', () => {
  const snapshot = roadmap([node('intro'), node('theory')], [['intro', 'theory']]);

  expect(planChange(snapshot, dependency('intro', 'theory'))).toEqual({
    kind: 'REJECTED',
    reason: 'DEPENDENCY_CONFLICT',
    message: 'La dependencia ya existe.',
  });
});

test('refuses a Dependency that would close a cycle', () => {
  const snapshot = roadmap(
    [node('intro'), node('theory'), node('assessment')],
    [
      ['intro', 'theory'],
      ['theory', 'assessment'],
    ],
  );

  expect(planChange(snapshot, dependency('assessment', 'intro'))).toEqual({
    kind: 'REJECTED',
    reason: 'DEPENDENCY_CYCLE',
    message: 'La dependencia formaría un ciclo.',
  });
});

test('a Dependency from a Node without a Teacher block blocks nothing', () => {
  expect(
    planChange(roadmap([node('intro'), node('theory')]), dependency('intro', 'theory')),
  ).toEqual({
    kind: 'ALLOWED',
    impact: { nodes: [], version: expect.any(String) },
    consequences: { blockedNodeIds: [], unblockedNodeIds: [], removedDependencyIds: [] },
  });
});

test('a Dependency from a Teacher-blocked Node blocks the target and its visible dependents, by title then identifier', () => {
  const snapshot = roadmap(
    [
      node('theory', { title: 'Teoría' }),
      node('intro', { title: 'Introducción', isTeacherBlocked: true }),
      node('exercises-b', { title: 'Ejercicios' }),
      node('quiz', { title: 'Control', isTeacherBlocked: true }),
      node('exercises-a', { title: 'Ejercicios' }),
      node('draft', { title: 'Borrador', isVisible: false }),
      node('unrelated', { title: 'Anexo' }),
    ],
    [
      ['theory', 'exercises-b'],
      ['theory', 'quiz'],
      ['quiz', 'exercises-a'],
    ],
  );

  expect(planChange(snapshot, dependency('intro', 'theory'))).toEqual({
    kind: 'ALLOWED',
    impact: {
      nodes: [
        { id: 'exercises-a', title: 'Ejercicios' },
        { id: 'exercises-b', title: 'Ejercicios' },
        { id: 'theory', title: 'Teoría' },
      ],
      version: expect.any(String),
    },
    consequences: {
      blockedNodeIds: ['exercises-a', 'exercises-b', 'theory'],
      unblockedNodeIds: [],
      removedDependencyIds: [],
    },
  });
});

function versionOf(plan: ReturnType<typeof planChange>) {
  if (plan.kind === 'REJECTED') throw new Error(plan.message);
  return plan.impact.version;
}

test('versions an equal Change impact equally, as a short string safe for an HTTP header', () => {
  const snapshot = roadmap([
    node('intro', { title: 'Introducción ✓ 日本語', isTeacherBlocked: true }),
    node('theory', { title: 'Teoría "avanzada"' }),
  ]);
  const version = versionOf(planChange(snapshot, dependency('intro', 'theory')));

  expect(version).toMatch(/^[0-9a-z]{1,16}$/);
  expect(versionOf(planChange(structuredClone(snapshot), dependency('intro', 'theory')))).toBe(
    version,
  );
});

test('versions a different Change impact differently', () => {
  const nodes = [node('intro', { isTeacherBlocked: true }), node('theory'), node('practice')];
  const version = versionOf(planChange(roadmap(nodes), dependency('intro', 'theory')));

  expect(
    versionOf(planChange(roadmap(nodes, [['theory', 'practice']]), dependency('intro', 'theory'))),
  ).not.toBe(version);
  expect(
    versionOf(
      planChange(
        roadmap(
          [...nodes.slice(0, 2), node('practice', { isTeacherBlocked: true })],
          [['theory', 'practice']],
        ),
        dependency('intro', 'theory'),
      ),
    ),
  ).toBe(version);
});

test.each([
  ['a different', 'previewed'],
  ['a missing', undefined],
])('refuses to confirm a Dependency with %s preview version as stale', (_, previewVersion) => {
  const snapshot = roadmap([node('intro'), node('theory')]);

  expect(confirmChange(snapshot, dependency('intro', 'theory'), previewVersion)).toEqual({
    kind: 'REJECTED',
    reason: 'DEPENDENCY_PREVIEW_STALE',
    message:
      'El impacto de la dependencia cambió. Revisa y confirma la previsualización actualizada.',
  });
});

test('confirms a Dependency whose previewed Change impact is unchanged', () => {
  const snapshot = roadmap([node('intro', { isTeacherBlocked: true }), node('theory')]);
  const plan = planChange(snapshot, dependency('intro', 'theory'));

  expect(confirmChange(snapshot, dependency('intro', 'theory'), versionOf(plan))).toEqual(plan);
});

test('refuses to confirm a Dependency that breaks a rule before checking its version', () => {
  expect(
    confirmChange(roadmap([node('intro')]), dependency('intro', 'intro'), undefined),
  ).toMatchObject({ kind: 'REJECTED', reason: 'SELF_DEPENDENCY' });
});

test.each([
  ['hide', 'NODE_VISIBILITY_PREVIEW_STALE', 'El impacto de ocultar el nodo cambió.'],
  ['delete', 'NODE_DELETE_PREVIEW_STALE', 'El impacto de la eliminación cambió.'],
  ['dependency', 'DEPENDENCY_PREVIEW_STALE', 'El impacto de la dependencia cambió.'],
  ['block', 'TEACHER_BLOCK_PREVIEW_STALE', 'El impacto del bloqueo cambió.'],
  ['unlock', 'TEACHER_BLOCK_PREVIEW_STALE', 'El impacto del desbloqueo cambió.'],
] as const)('rejects a stale %s preview version', (change, reason, message) => {
  expect(
    decideChangeImpactVersion({ change, sentVersion: 'previewed', version: 'current' }),
  ).toEqual({
    kind: 'REJECTED',
    reason,
    message: `${message} Revisa y confirma la previsualización actualizada.`,
  });
});

test('allows a preview version that still matches the Change impact', () => {
  expect(
    decideChangeImpactVersion({ change: 'unlock', sentVersion: 'same', version: 'same' }),
  ).toEqual({
    kind: 'ALLOWED',
  });
});

test.each([
  ['hide', 'NODE_VISIBILITY_PREVIEW_STALE'],
  ['delete', 'NODE_DELETE_PREVIEW_STALE'],
  ['dependency', 'DEPENDENCY_PREVIEW_STALE'],
  ['block', 'TEACHER_BLOCK_PREVIEW_STALE'],
  ['unlock', 'TEACHER_BLOCK_PREVIEW_STALE'],
] as const)(
  'requires a %s confirmation to send its previewed Change impact version',
  (change, reason) => {
    expect(
      decideChangeImpactVersion({ change, sentVersion: undefined, version: 'current' }),
    ).toMatchObject({ kind: 'REJECTED', reason });
  },
);
