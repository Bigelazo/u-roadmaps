import type { AcademicOverviewCourse, AcademicOverviewPage } from '../types';
import {
  academicOverviewCourseKey,
  groupAcademicOverviewCoursesByAcademicTerm,
  uniqueAcademicOverviewCourses,
} from './overview-courses';

export const ACADEMIC_CACHE_VERSION = 1;
export const ACADEMIC_CACHE_LIFETIME_MS = 24 * 60 * 60 * 1000;
export const ACADEMIC_CACHE_PREFIX = 'u-roadmaps:academic-courses:';
export const ACADEMIC_CACHE_IDENTITY = 'u-roadmaps:academic-identity';

export type AcademicCourseInformation = Pick<
  AcademicOverviewCourse,
  'courseCode' | 'name' | 'year' | 'semester' | 'section'
>;
export type AcademicCourseCache = Readonly<{
  version: typeof ACADEMIC_CACHE_VERSION;
  userId: string;
  synchronizedAt: number;
  expiresAt: number;
  courses: readonly AcademicCourseInformation[];
}>;

export function createAcademicCourseCache(
  userId: string,
  courses: readonly AcademicCourseInformation[],
  now: number,
): AcademicCourseCache {
  return {
    version: ACADEMIC_CACHE_VERSION,
    userId,
    synchronizedAt: now,
    expiresAt: now + ACADEMIC_CACHE_LIFETIME_MS,
    courses: courses.map(({ courseCode, name, year, semester, section }) => ({
      courseCode,
      name,
      year,
      semester,
      section,
    })),
  };
}

function isCourse(value: unknown): value is AcademicCourseInformation {
  if (!value || typeof value !== 'object') return false;
  const course = value as Record<string, unknown>;
  return (
    typeof course.courseCode === 'string' &&
    course.courseCode.length > 0 &&
    typeof course.name === 'string' &&
    course.name.length > 0 &&
    Number.isInteger(course.year) &&
    (course.semester === 1 || course.semester === 2) &&
    (course.section === null || typeof course.section === 'string')
  );
}

export function parseAcademicCourseCache(
  raw: string | null,
  userId: string,
  now: number,
  allowExpired = false,
): AcademicCourseCache | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (
      !value ||
      value.version !== ACADEMIC_CACHE_VERSION ||
      value.userId !== userId ||
      !Number.isFinite(value.synchronizedAt) ||
      !Number.isFinite(value.expiresAt) ||
      value.synchronizedAt > now ||
      value.expiresAt !== value.synchronizedAt + ACADEMIC_CACHE_LIFETIME_MS ||
      (!allowExpired && value.expiresAt <= now) ||
      !Array.isArray(value.courses) ||
      !value.courses.every(isCourse)
    )
      return null;
    return createAcademicCourseCache(userId, value.courses, value.synchronizedAt);
  } catch {
    return null;
  }
}

export function presentCachedAcademicCourses(
  local: AcademicOverviewPage,
  cache: AcademicCourseCache,
): AcademicOverviewPage {
  const information = new Map<string, AcademicCourseInformation>();
  for (const course of cache.courses) {
    const key = academicOverviewCourseKey(course);
    if (!information.has(key)) information.set(key, course);
  }
  const courses = local.terms
    .flatMap((term) => term.courses)
    .map((course) => {
      const cached = information.get(academicOverviewCourseKey(course));
      return {
        ...course,
        name: cached?.name ?? course.name,
        section: cached?.section ?? course.section,
        isPositionConfirmed: false,
      };
    });
  return {
    source: 'CACHE',
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}
