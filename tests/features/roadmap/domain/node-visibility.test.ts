import { expect, test } from 'vitest';
import { decideVisibilityChange } from '@/features/roadmap/domain/node-visibility';

const dependencies = [
  { id: 'intro-theory', sourceNodeId: 'intro', targetNodeId: 'theory' },
  { id: 'theory-quiz', sourceNodeId: 'theory', targetNodeId: 'quiz' },
  { id: 'intro-quiz', sourceNodeId: 'intro', targetNodeId: 'quiz' },
];

test('a hidden Node loses its Dependencies, Teacher block and Scheduled unlock', () => {
  expect(decideVisibilityChange({ nodeId: 'theory', isVisible: false, dependencies })).toEqual({
    removedDependencies: [dependencies[0], dependencies[1]],
    clearsTeacherBlock: true,
  });
});

test('a visible Node keeps its Dependencies and Teacher block', () => {
  expect(decideVisibilityChange({ nodeId: 'theory', isVisible: true, dependencies })).toEqual({
    removedDependencies: [],
    clearsTeacherBlock: false,
  });
});
