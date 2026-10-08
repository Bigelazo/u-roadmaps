import { expect, it } from 'vitest';
import { uniqueAcademicOverviewCourses } from '@/features/academic-overview/domain/overview-courses';
import type { AcademicOverviewCourse } from '@/features/academic-overview/types';

const priorities = [
  'COURSE_PROFESSOR',
  'COORDINATING_PROFESSOR',
  'AUXILIARY_PROFESSOR',
  'TEACHING_ASSISTANT',
  null,
  'OBSERVER',
] as const;

it.each(priorities.slice(0, -1))('prefers %s to every lower institutional position', (position) => {
  const lower = priorities.slice(priorities.indexOf(position) + 1);
  const offering = (
    institutionalPosition: (typeof priorities)[number],
  ): AcademicOverviewCourse => ({
    courseCode: 'CC1002',
    name: 'Programación',
    department: null,
    year: 2026,
    semester: 2,
    section: null,
    institutionalPosition,
    role: institutionalPosition && institutionalPosition !== 'OBSERVER' ? 'TEACHER' : 'STUDENT',
    hasRoadmap: true,
    canCreateRoadmap: institutionalPosition === 'COURSE_PROFESSOR',
  });
  for (const other of lower) {
    expect(uniqueAcademicOverviewCourses([offering(other), offering(position)])).toEqual([
      offering(position),
    ]);
    expect(uniqueAcademicOverviewCourses([offering(position), offering(other)])).toEqual([
      offering(position),
    ]);
  }
});
