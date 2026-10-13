import { describe, expect, it } from 'vitest';
import {
  averageStudentCompletion,
  compareCourseMembers,
  completionRatio,
} from '@/features/roadmap/domain/course-progress';

describe('completionRatio', () => {
  it('measures completed visible Nodes over every visible Node', () => {
    expect(completionRatio(3, 4)).toBe(0.75);
    expect(completionRatio(0, 4)).toBe(0);
  });

  it('has no measure for a Roadmap without visible Nodes', () => {
    expect(completionRatio(0, 0)).toBeNull();
  });
});

describe('averageStudentCompletion', () => {
  it('averages students only, including those without Completions', () => {
    expect(
      averageStudentCompletion([
        { institutionalPosition: 'STUDENT', completion: 1 },
        { institutionalPosition: 'STUDENT', completion: 0 },
        { institutionalPosition: 'STUDENT', completion: 0.5 },
        { institutionalPosition: 'OBSERVER', completion: 0 },
        { institutionalPosition: 'TEACHING_ASSISTANT', completion: null },
      ]),
    ).toBe(0.5);
  });

  it('has no average without students', () => {
    expect(
      averageStudentCompletion([{ institutionalPosition: 'OBSERVER', completion: 1 }]),
    ).toBeNull();
  });
});

it('orders members by position precedence, unknown positions last, then by name', () => {
  const members = [
    { name: 'Zoe', institutionalPosition: 'STUDENT' as const },
    { name: 'Ana', institutionalPosition: 'OBSERVER' as const },
    { name: 'Ben', institutionalPosition: null },
    { name: 'Álvaro', institutionalPosition: 'STUDENT' as const },
    { name: 'Carla', institutionalPosition: 'COURSE_PROFESSOR' as const },
  ];
  expect(members.sort(compareCourseMembers).map(({ name }) => name)).toEqual([
    'Carla',
    'Álvaro',
    'Zoe',
    'Ana',
    'Ben',
  ]);
});
