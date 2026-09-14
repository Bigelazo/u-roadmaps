import { expect, test } from 'vitest';
import { parseCourseOfferingIdentifier } from '@/features/roadmap/domain/course-offering-identifier';

test('parses a Course offering identifier without changing its Course code', () => {
  expect(
    parseCourseOfferingIdentifier({ courseCode: '  MaTe101  ', year: '2026', semester: '2' }),
  ).toEqual({ courseCode: 'MaTe101', year: 2026, semester: 2 });
});

test('decodes the route segment before removing peripheral whitespace', () => {
  expect(
    parseCourseOfferingIdentifier({ courseCode: '%20MaTe101%20', year: '2026', semester: '2' }),
  ).toEqual({ courseCode: 'MaTe101', year: 2026, semester: 2 });
});

test.each([
  ['empty Course code', { courseCode: '', year: '2026', semester: '1' }],
  ['whitespace-only Course code', { courseCode: '   ', year: '2026', semester: '1' }],
  [
    'Course code longer than twenty characters',
    { courseCode: 'A'.repeat(21), year: '2026', semester: '1' },
  ],
  ['non-integer year', { courseCode: 'MAT101', year: '2026.5', semester: '1' }],
  ['non-positive year', { courseCode: 'MAT101', year: '0', semester: '1' }],
  ['non-numeric year', { courseCode: 'MAT101', year: 'not-a-year', semester: '1' }],
  ['unsupported semester', { courseCode: 'MAT101', year: '2026', semester: '3' }],
  ['non-integer semester', { courseCode: 'MAT101', year: '2026', semester: '1.5' }],
])('%s returns null', (_description, params) => {
  expect(parseCourseOfferingIdentifier(params)).toBeNull();
});
