import { expect, it } from 'vitest';
import { effectivePosition, positionCapabilities } from '@/shared/institutional-position';

it.each([
  ['COURSE_PROFESSOR', true, true],
  ['COORDINATING_PROFESSOR', true, false],
  ['AUXILIARY_PROFESSOR', true, false],
  ['TEACHING_ASSISTANT', true, false],
  ['STUDENT', false, false],
  ['OBSERVER', false, false],
  [null, false, false],
] as const)('grants the documented capabilities for %s', (position, teaching, creation) => {
  expect(positionCapabilities(position)).toEqual({
    isTeachingStaff: teaching,
    canEdit: teaching,
    canCreateRoadmap: creation,
    role: teaching ? 'TEACHER' : 'STUDENT',
  });
});

// Enumerate all 64 subsets, with expected precedence supplied by the spec.
const precedence = [
  'COURSE_PROFESSOR',
  'COORDINATING_PROFESSOR',
  'AUXILIARY_PROFESSOR',
  'TEACHING_ASSISTANT',
  'STUDENT',
  'OBSERVER',
] as const;
for (let mask = 0; mask < 64; mask++) {
  const positions = precedence.filter((_, index) => mask & (1 << index));
  it(`resolves effective position for ${positions.join(', ') || 'unknown'}`, () => {
    expect(effectivePosition(positions.toReversed())).toBe(positions[0] ?? null);
  });
}
