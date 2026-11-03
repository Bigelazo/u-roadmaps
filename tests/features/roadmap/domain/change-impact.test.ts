import { expect, test } from 'vitest';
import {
  confirmChange,
  planChange,
  type RoadmapSnapshot,
} from '@/features/roadmap/domain/change-impact';
import { unknownNodeType } from '@/features/roadmap/node-type-appearance';

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

function teacherBlock(nodeId: string, operation: 'BLOCK' | 'UNBLOCK' | 'BRANCH_UNLOCK') {
  return { kind: 'change-teacher-block', nodeId, operation } as const;
}

const content = { name: 'Contenido', icon: 'BookOpen', color: '#024AD8' };

test('a Teacher block blocks the Node and its visible dependents without one, by title then identifier', () => {
  const snapshot = roadmap(
    [
      node('selected', { title: 'Seleccionado' }),
      node('visible-b', { title: 'Visible' }),
      node('visible-a', { title: 'Visible', nodeTypeId: 'missing' }),
      node('blocked', { title: 'Bloqueado', isTeacherBlocked: true }),
      node('hidden', { title: 'Oculto', isVisible: false }),
      node('unrelated', { title: 'Anexo' }),
    ],
    [
      ['selected', 'visible-b'],
      ['selected', 'blocked'],
      ['blocked', 'visible-a'],
    ],
  );

  expect(planChange(snapshot, teacherBlock('selected', 'BLOCK'))).toEqual({
    kind: 'ALLOWED',
    impact: {
      mode: 'BLOCK',
      nodes: [
        { id: 'selected', title: 'Seleccionado', nodeType: content, relation: 'SELECTED_NODE' },
        { id: 'visible-a', title: 'Visible', nodeType: unknownNodeType, relation: 'DEPENDENT' },
        { id: 'visible-b', title: 'Visible', nodeType: content, relation: 'DEPENDENT' },
      ],
      version: expect.any(String),
    },
    consequences: {
      blockedNodeIds: ['selected', 'visible-a', 'visible-b'],
      unblockedNodeIds: [],
      removedDependencyIds: [],
    },
  });
});

test.each([
  ['missing', 'NODE_NOT_FOUND', 'El nodo no existe en este roadmap.'],
  [
    'draft',
    'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
    'Un nodo oculto no puede tener un bloqueo docente.',
  ],
])('refuses a Teacher block on the %s Node', (nodeId, reason, message) => {
  const snapshot = roadmap([node('draft', { isVisible: false })]);

  expect(planChange(snapshot, teacherBlock(nodeId, 'BLOCK'))).toEqual({
    kind: 'REJECTED',
    reason,
    message,
  });
});

const convergent = roadmap(
  [
    node('d', { title: 'D', isTeacherBlocked: true }),
    node('c', { title: 'C', isTeacherBlocked: true }),
    node('b', { title: 'B', isTeacherBlocked: true }),
    node('a', { title: 'A', isTeacherBlocked: true }),
    node('free', { title: 'Libre' }),
  ],
  [
    ['a', 'c'],
    ['b', 'c'],
    ['free', 'c'],
    ['c', 'd'],
  ],
);

test('a Node unlock with a Teacher-blocked prerequisite unlocks every blocked prerequisite through convergent paths', () => {
  expect(planChange(convergent, teacherBlock('c', 'BRANCH_UNLOCK'))).toEqual({
    kind: 'ALLOWED',
    impact: {
      mode: 'UPSTREAM',
      nodes: [
        { id: 'a', title: 'A', nodeType: content, relation: 'PREREQUISITE' },
        { id: 'b', title: 'B', nodeType: content, relation: 'PREREQUISITE' },
        { id: 'c', title: 'C', nodeType: content, relation: 'SELECTED_NODE' },
      ],
      version: expect.any(String),
    },
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: ['a', 'b', 'c'],
      removedDependencyIds: [],
    },
  });
});

test('a Node unlock without a Teacher-blocked prerequisite unlocks only the selected Node', () => {
  expect(planChange(convergent, teacherBlock('a', 'UNBLOCK'))).toMatchObject({
    impact: {
      mode: 'SINGLE',
      nodes: [{ id: 'a', title: 'A', nodeType: content, relation: 'SELECTED_NODE' }],
    },
    consequences: { unblockedNodeIds: ['a'] },
  });
});

test('a Branch unlock unlocks the eligible dependents, keeping those an external blocked prerequisite holds', () => {
  const snapshot = roadmap(
    [
      node('root', { title: 'Raíz', isTeacherBlocked: true }),
      node('held', { title: 'Retenido', isTeacherBlocked: true }),
      node('outside', { title: 'Externo', isTeacherBlocked: true }),
      node('after-held', { title: 'Posterior', isTeacherBlocked: true }),
      node('eligible', { title: 'Elegible', isTeacherBlocked: true }),
    ],
    [
      ['root', 'held'],
      ['outside', 'held'],
      ['held', 'after-held'],
      ['root', 'eligible'],
    ],
  );

  expect(planChange(snapshot, teacherBlock('root', 'BRANCH_UNLOCK'))).toMatchObject({
    impact: {
      mode: 'BRANCH',
      nodes: [
        { id: 'eligible', relation: 'DEPENDENT' },
        { id: 'root', relation: 'SELECTED_NODE' },
      ],
    },
    consequences: { unblockedNodeIds: ['eligible', 'root'] },
  });
});

test('a Node unlock also releases the due Scheduled unlocks it no longer holds, outside its Change impact', () => {
  const snapshot = roadmap(
    [
      node('unlocked', { title: 'Desbloqueado', isTeacherBlocked: true }),
      node('released', { isTeacherBlocked: true, teacherUnlockOn: '2026-11-03' }),
      node('future', { isTeacherBlocked: true, teacherUnlockOn: '2026-11-04' }),
      node('still-blocked', { isTeacherBlocked: true }),
      node('waiting', { isTeacherBlocked: true, teacherUnlockOn: '2026-11-02' }),
    ],
    [
      ['unlocked', 'released'],
      ['unlocked', 'future'],
      ['unlocked', 'waiting'],
      ['still-blocked', 'waiting'],
    ],
  );

  expect(planChange(snapshot, teacherBlock('unlocked', 'UNBLOCK'))).toMatchObject({
    impact: { mode: 'SINGLE', nodes: [{ id: 'unlocked' }] },
    consequences: { unblockedNodeIds: ['unlocked', 'released'] },
  });
  expect(planChange(snapshot, teacherBlock('unlocked', 'BLOCK'))).toMatchObject({
    consequences: { unblockedNodeIds: [] },
  });
});

const touching = roadmap(
  [
    node('theory', { title: 'Teoría', isTeacherBlocked: true, teacherUnlockOn: '2026-11-04' }),
    node('intro', { title: 'Introducción' }),
    node('quiz', { title: 'Control' }),
    node('unrelated', { title: 'Anexo' }),
  ],
  [
    ['theory', 'quiz'],
    ['intro', 'theory'],
    ['intro', 'unrelated'],
  ],
);

test('hiding a Node removes every Dependency touching it, by identifier, with its Teacher block and Scheduled unlock', () => {
  expect(planChange(touching, { kind: 'hide-node', nodeId: 'theory' })).toEqual({
    kind: 'ALLOWED',
    impact: {
      dependencies: [
        { id: 'intro-theory', sourceNodeId: 'intro', targetNodeId: 'theory' },
        { id: 'theory-quiz', sourceNodeId: 'theory', targetNodeId: 'quiz' },
      ],
      version: expect.any(String),
    },
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: ['theory'],
      removedDependencyIds: ['intro-theory', 'theory-quiz'],
    },
  });
});

test('deleting a Node shows it with its Node type, its Dependencies by identifier and its Resources by title then identifier', () => {
  const snapshot = {
    ...touching,
    nodes: touching.nodes.map((candidate) =>
      candidate.id === 'theory'
        ? {
            ...candidate,
            resources: [
              { id: 'slides', title: 'Presentación' },
              { id: 'guide-b', title: 'Guía' },
              { id: 'guide-a', title: 'Guía' },
            ],
          }
        : candidate,
    ),
  };

  expect(planChange(snapshot, { kind: 'delete-node', nodeId: 'theory' })).toEqual({
    kind: 'ALLOWED',
    impact: {
      node: { title: 'Teoría', nodeType: content },
      dependencies: [
        { id: 'intro-theory', sourceTitle: 'Introducción', targetTitle: 'Teoría' },
        { id: 'theory-quiz', sourceTitle: 'Teoría', targetTitle: 'Control' },
      ],
      resources: [
        { id: 'guide-a', title: 'Guía' },
        { id: 'guide-b', title: 'Guía' },
        { id: 'slides', title: 'Presentación' },
      ],
      version: expect.any(String),
    },
    consequences: {
      blockedNodeIds: [],
      unblockedNodeIds: [],
      removedDependencyIds: ['intro-theory', 'theory-quiz'],
    },
  });
});

test.each(['hide-node', 'delete-node'] as const)(
  'refuses to %s a Node that is not in the Roadmap',
  (kind) => {
    expect(planChange(touching, { kind, nodeId: 'missing' })).toEqual({
      kind: 'REJECTED',
      reason: 'NODE_NOT_FOUND',
      message: 'El nodo no existe en este roadmap.',
    });
  },
);

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

test.each([
  ['BLOCK', 'del bloqueo'],
  ['UNBLOCK', 'del desbloqueo'],
  ['BRANCH_UNLOCK', 'del desbloqueo'],
] as const)('refuses to confirm a stale %s as stale', (operation, impact) => {
  const snapshot = roadmap([node('intro', { isTeacherBlocked: true })]);

  expect(confirmChange(snapshot, teacherBlock('intro', operation), undefined)).toEqual({
    kind: 'REJECTED',
    reason: 'TEACHER_BLOCK_PREVIEW_STALE',
    message: `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
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
  ['hide-node', undefined, 'NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  ['hide-node', 'previewed', 'NODE_VISIBILITY_PREVIEW_STALE', 'de ocultar el nodo'],
  ['delete-node', undefined, 'NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
  ['delete-node', 'previewed', 'NODE_DELETE_PREVIEW_STALE', 'de la eliminación'],
] as const)(
  'refuses to confirm %s with the preview version %s as stale',
  (kind, previewVersion, reason, impact) => {
    expect(confirmChange(touching, { kind, nodeId: 'theory' }, previewVersion)).toEqual({
      kind: 'REJECTED',
      reason,
      message: `El impacto ${impact} cambió. Revisa y confirma la previsualización actualizada.`,
    });
  },
);

test.each(['hide-node', 'delete-node'] as const)(
  'confirms %s whose previewed Change impact is unchanged',
  (kind) => {
    const plan = planChange(touching, { kind, nodeId: 'theory' });

    expect(confirmChange(touching, { kind, nodeId: 'theory' }, versionOf(plan))).toEqual(plan);
  },
);
