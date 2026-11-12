import { describe, expect, test } from 'vitest';
import {
  ACADEMIC_CACHE_LIFETIME_MS,
  createAcademicCourseCache,
  parseAcademicCourseCache,
  presentCachedAcademicCourses,
} from '@/features/academic-overview/domain/browser-cache';
import type { AcademicOverviewPage } from '@/features/academic-overview/types';

const now = 1_800_000_000_000;
const information = {
  courseCode: 'CC1002',
  name: 'Programación',
  year: 2026,
  semester: 2,
  section: '1',
};
const snapshot = createAcademicCourseCache('user-a', [information], now);

describe('bounded personal course snapshots', () => {
  test('a valid snapshot expires exactly at the centralized deadline', () => {
    expect(
      parseAcademicCourseCache(
        JSON.stringify(snapshot),
        'user-a',
        now + ACADEMIC_CACHE_LIFETIME_MS - 1,
      ),
    ).toEqual(snapshot);
    expect(
      parseAcademicCourseCache(
        JSON.stringify(snapshot),
        'user-a',
        now + ACADEMIC_CACHE_LIFETIME_MS,
      ),
    ).toBeNull();
    expect(
      parseAcademicCourseCache(
        JSON.stringify(snapshot),
        'user-a',
        now + ACADEMIC_CACHE_LIFETIME_MS,
        true,
      ),
    ).toEqual(snapshot);
  });
  test.each([
    ['another identity', { ...snapshot, userId: 'user-b' }],
    ['another schema', { ...snapshot, version: 2 }],
    ['a future synchronization', { ...snapshot, synchronizedAt: now + 1 }],
    ['an indefinite lifetime', { ...snapshot, expiresAt: now + ACADEMIC_CACHE_LIFETIME_MS * 10 }],
    ['invalid courses', { ...snapshot, courses: [{ ...information, semester: 3 }] }],
    ['invalid synchronization time', { ...snapshot, synchronizedAt: 'yesterday' }],
    ['missing courses', { ...snapshot, courses: null }],
  ])('rejects %s', (_name, value) => {
    expect(parseAcademicCourseCache(JSON.stringify(value), 'user-a', now)).toBeNull();
  });
  test.each([null, '{bad', 'null', '[]'])('malformed storage %s is a cache miss', (raw) => {
    expect(parseAcademicCourseCache(raw, 'user-a', now)).toBeNull();
  });
  test('projection retains current participation fields and never resurrects a cached offering', () => {
    const local: AcademicOverviewPage = {
      source: 'LOCAL',
      terms: [
        {
          year: 2026,
          semester: 2,
          courses: [
            {
              ...information,
              section: null,
              name: 'Local',
              department: 'DCC',
              role: 'STUDENT',
              institutionalPosition: 'STUDENT',
              hasRoadmap: true,
              progress: { completedNodes: 2, visibleNodes: 4 },
              isPastClosure: false,
              canCreateRoadmap: false,
              isPositionConfirmed: true,
            },
          ],
        },
      ],
    };
    const cache = createAcademicCourseCache(
      'user-a',
      [
        { ...information, canCreateRoadmap: true } as typeof information,
        { ...information, courseCode: 'CC9999' },
      ],
      now,
    );
    const result = presentCachedAcademicCourses(local, cache);
    expect(result.source).toBe('CACHE');
    expect(result.terms[0].courses).toEqual([
      {
        ...local.terms[0].courses[0],
        name: information.name,
        section: '1',
        isPositionConfirmed: false,
      },
    ]);
    expect(cache.courses[0]).not.toHaveProperty('canCreateRoadmap');
  });
});
