import { expect, expectTypeOf, test } from 'vitest';
import {
  eligibleBranchUnlockNodeIds,
  studentNodeAccessById,
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

test('gives teacher blocks precedence and keeps historical completions intact while access is blocked', () => {
  const completedNodeIds = new Set(['intro', 'theory', 'practice', 'assessment']);
  const access = studentNodeAccessById({
    nodes: [
      { id: 'intro', isTeacherBlocked: false },
      { id: 'theory', isTeacherBlocked: false },
      { id: 'practice', isTeacherBlocked: true },
      { id: 'assessment', isTeacherBlocked: true },
      { id: 'extension', isTeacherBlocked: true },
    ],
    dependencies: diamondDependencies,
    completedNodeIds,
  });

  expect(access.get('intro')).toEqual({ status: 'ACCESSIBLE' });
  expect(access.get('practice')).toEqual({ status: 'BLOCKED', reason: 'TEACHER_BLOCK' });
  expect(access.get('assessment')).toEqual({ status: 'BLOCKED', reason: 'TEACHER_BLOCK' });
  expect(access.get('extension')).toEqual({ status: 'BLOCKED', reason: 'TEACHER_BLOCK' });
  expect([...completedNodeIds]).toEqual(['intro', 'theory', 'practice', 'assessment']);
});

test('models a pending prerequisite separately from a teacher block', () => {
  const access = studentNodeAccessById({
    nodes: [
      { id: 'prerequisite', isTeacherBlocked: false },
      { id: 'selected', isTeacherBlocked: false },
    ],
    dependencies: [{ sourceNodeId: 'prerequisite', targetNodeId: 'selected' }],
    completedNodeIds: new Set(),
  });

  expect(access.get('selected')).toEqual({ status: 'BLOCKED', reason: 'PREREQUISITE_BLOCK' });
});

test('a teacher block prevails over a simultaneous prerequisite block', () => {
  const access = studentNodeAccessById({
    nodes: [
      { id: 'prerequisite', isTeacherBlocked: false },
      { id: 'selected', isTeacherBlocked: true },
    ],
    dependencies: [{ sourceNodeId: 'prerequisite', targetNodeId: 'selected' }],
    completedNodeIds: new Set(),
  });

  expect(access.get('selected')).toEqual({ status: 'BLOCKED', reason: 'TEACHER_BLOCK' });
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
    nodes: [
      { id: 'selected', title: 'Seleccionado' },
      { id: 'visible', title: 'Visible' },
    ],
  });
});

// This is a compile-time contract test, so it has no runtime assertion.
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
