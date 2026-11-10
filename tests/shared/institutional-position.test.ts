import { expect, it } from 'vitest';
import { effectivePosition, outranks, positionCapabilities } from '@/shared/institutional-position';

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

it('ranks every position above every lower one and above an unknown position', () => {
  for (const [index, position] of precedence.entries()) {
    for (const lower of [...precedence.slice(index + 1), null])
      expect(outranks(position, lower)).toBe(true);
    for (const higherOrSame of precedence.slice(0, index + 1))
      expect(outranks(position, higherOrSame)).toBe(false);
  }
  expect(outranks(null, null)).toBe(false);
  expect(outranks(null, 'OBSERVER')).toBe(false);
});
