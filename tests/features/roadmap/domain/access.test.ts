import { expect, expectTypeOf, test } from 'vitest';
import {
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
import { decideTeacherBlock } from '@/features/roadmap/domain/teacher-block';
import type { RoadmapNode } from '@/features/roadmap/types';

const diamondDependencies = [
  { sourceNodeId: 'intro', targetNodeId: 'theory' },
  { sourceNodeId: 'intro', targetNodeId: 'practice' },
  { sourceNodeId: 'theory', targetNodeId: 'assessment' },
  { sourceNodeId: 'practice', targetNodeId: 'assessment' },
  { sourceNodeId: 'assessment', targetNodeId: 'extension' },
];

test('traverses chains, branches, convergences, and diamonds without revisiting nodes', () => {
  expect([...transitiveDependentNodeIds(diamondDependencies, 'intro')]).toEqual([
    'theory',
    'practice',
    'assessment',
    'extension',
  ]);
  expect([...transitivePrerequisiteNodeIds(diamondDependencies, 'extension')]).toEqual([
    'assessment',
    'theory',
    'practice',
    'intro',
  ]);
});

test('preserves the existing prohibition on cycles without confusing a diamond for one', () => {
  expect(wouldCreateDependencyCycle(diamondDependencies, 'extension', 'intro')).toBe(true);
  expect(wouldCreateDependencyCycle(diamondDependencies, 'theory', 'practice')).toBe(false);
});

test('unlocks every blocked node in an eligible branch without recording its blocking history', () => {
  expect([
    ...eligibleBranchUnlockNodeIds({
      dependencies: diamondDependencies,
      teacherBlockedNodeIds: new Set(['intro', 'theory', 'practice', 'assessment', 'extension']),
      rootNodeId: 'intro',
    }),
  ]).toEqual(['intro', 'theory', 'practice', 'assessment', 'extension']);
});

test('keeps a branch blocked when an external blocked prerequisite still holds it', () => {
  const dependencies = [{ sourceNodeId: 'outside', targetNodeId: 'intro' }, ...diamondDependencies];

  expect([
    ...eligibleBranchUnlockNodeIds({
      dependencies,
      teacherBlockedNodeIds: new Set([
        'outside',
        'intro',
        'theory',
        'practice',
        'assessment',
        'extension',
      ]),
      rootNodeId: 'intro',
    }),
  ]).toEqual([]);
});

test('keeps teacher-block policy pure while excluding hidden dependent nodes', () => {
  expect(
    decideTeacherBlock({
      nodes: [
        { id: 'selected', title: 'Seleccionado', isVisible: true, isTeacherBlocked: false },
        { id: 'visible', title: 'Visible', isVisible: true, isTeacherBlocked: false },
        { id: 'hidden', title: 'Oculto', isVisible: false, isTeacherBlocked: false },
      ],
      dependencies: [
        { sourceNodeId: 'selected', targetNodeId: 'visible' },
        { sourceNodeId: 'selected', targetNodeId: 'hidden' },
      ],
      nodeId: 'selected',
      operation: 'BLOCK',
    }),
  ).toEqual({
    kind: 'ALLOWED',
    mode: 'BLOCK',
    nodes: [
      { id: 'selected', title: 'Seleccionado', relation: 'SELECTED_NODE' },
      { id: 'visible', title: 'Visible', relation: 'DEPENDENT' },
    ],
  });
});

test('contextual unlock traverses every blocked prerequisite in convergent paths without unlocking dependents', () => {
  const nodes = [
    { id: 'a', title: 'A', isVisible: true, isTeacherBlocked: true },
    { id: 'b', title: 'B', isVisible: true, isTeacherBlocked: true },
    { id: 'c', title: 'C', isVisible: true, isTeacherBlocked: true },
    { id: 'd', title: 'D', isVisible: true, isTeacherBlocked: true },
  ];
  const dependencies = [
    { sourceNodeId: 'a', targetNodeId: 'c' },
    { sourceNodeId: 'b', targetNodeId: 'c' },
    { sourceNodeId: 'c', targetNodeId: 'd' },
  ];

  expect(decideTeacherBlock({ nodes, dependencies, nodeId: 'a', operation: 'UNBLOCK' })).toEqual({
    kind: 'ALLOWED',
    mode: 'SINGLE',
    nodes: [{ id: 'a', title: 'A', relation: 'SELECTED_NODE' }],
  });

  expect(
    decideTeacherBlock({
      nodes,
      dependencies,
      nodeId: 'c',
      operation: 'UNBLOCK',
    }),
  ).toEqual({
    kind: 'ALLOWED',
    mode: 'UPSTREAM',
    nodes: [
      { id: 'a', title: 'A', relation: 'PREREQUISITE' },
      { id: 'b', title: 'B', relation: 'PREREQUISITE' },
      { id: 'c', title: 'C', relation: 'SELECTED_NODE' },
    ],
  });
});

// eslint-disable-next-line vitest/expect-expect
test('models hidden nodes and teacher blocks as incompatible states', () => {
  // @ts-expect-error Hidden nodes cannot retain a teacher block.
  const hiddenTeacherBlockedNode: RoadmapNode = {
    id: 'hidden',
    title: 'Borrador',
    positionX: 0,
    positionY: 0,
    nodeTypeId: 'content',
    description: null,
    isVisible: false,
    isTeacherBlocked: true,
    resources: [],
  };

  expectTypeOf(hiddenTeacherBlockedNode).toMatchTypeOf<RoadmapNode>();
});

test('rejects a Teacher block on a hidden Node with its explanation', () => {
  expect(
    decideTeacherBlock({
      nodes: [{ id: 'draft', title: 'Borrador', isVisible: false, isTeacherBlocked: false }],
      dependencies: [],
      nodeId: 'draft',
      operation: 'BLOCK',
    }),
  ).toEqual({
    kind: 'REJECTED',
    reason: 'HIDDEN_NODE_TEACHER_BLOCK_FORBIDDEN',
    message: 'Un nodo oculto no puede tener un bloqueo docente.',
  });
});
