import { expect, expectTypeOf, test } from 'vitest';
import {
  dependencyRejection,
  eligibleBranchUnlockNodeIds,
  transitiveDependentNodeIds,
  transitivePrerequisiteNodeIds,
  wouldCreateDependencyCycle,
} from '@/features/roadmap/domain/access';
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

test.each([
  { name: 'self', source: 'a', target: 'a', hidden: [], expected: 'SELF_DEPENDENCY' },
  {
    name: 'hidden end',
    source: 'a',
    target: 'c',
    hidden: ['c'],
    expected: 'HIDDEN_NODE_DEPENDENCY_FORBIDDEN',
  },
  { name: 'duplicate', source: 'a', target: 'b', hidden: [], expected: 'DEPENDENCY_CONFLICT' },
  { name: 'cycle', source: 'c', target: 'a', hidden: [], expected: 'DEPENDENCY_CYCLE' },
  { name: 'allowed', source: 'a', target: 'c', hidden: [], expected: null },
])('dependencyRejection reports $name', ({ source, target, hidden, expected }) => {
  const dependencies = [
    { sourceNodeId: 'a', targetNodeId: 'b' },
    { sourceNodeId: 'b', targetNodeId: 'c' },
  ];
  const hiddenIds: readonly string[] = hidden;
  const end = (id: string) => ({ id, isVisible: !hiddenIds.includes(id) });
  expect(dependencyRejection(dependencies, end(source), end(target))).toBe(expected);
});
