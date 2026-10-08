import 'server-only';

import {
  getMufasaAcademicCourses,
  isCourseLeadPosition,
  isTeachingPosition,
  type MufasaEnrolledCoursesResult,
} from '@/integrations/ucampus/server';
import {
  academicOverviewCourseKey,
  groupAcademicOverviewCoursesByAcademicTerm,
  uniqueAcademicOverviewCourses,
} from '../domain/overview-courses';
import { readLocalAcademicOverview } from '../infrastructure/read-local-academic-overview';
import type {
  AcademicOverviewActor,
  AcademicOverviewApiOffering,
  AcademicOverviewApiResponse,
  AcademicOverviewCourse,
  AcademicOverviewPage,
} from '../types';

async function getAcademicOverview(
  actor: AcademicOverviewActor,
  source?: MufasaEnrolledCoursesResult,
) {
  const [mufasa, localCourses] = await Promise.all([
    source ??
      getMufasaAcademicCourses(actor.rut, {
        useLocalFixtureData: actor.useLocalFixtureData === true,
      }),
    readLocalAcademicOverview(actor),
  ]);
  return { mufasa, localCourses };
}

function courseFromMufasa(
  course: Awaited<ReturnType<typeof getMufasaAcademicCourses>>['courses'][number],
  localCourse: AcademicOverviewCourse | undefined,
  isComplete: boolean,
): AcademicOverviewCourse {
  return {
    courseCode: course.courseCode,
    name: course.name,
    year: course.year,
    semester: course.semester,
    section: course.section,
    department: localCourse?.department ?? null,
    role: localCourse
      ? localCourse.role
      : isTeachingPosition(course.institutionalPosition)
        ? 'TEACHER'
        : 'STUDENT',
    institutionalPosition: localCourse
      ? localCourse.institutionalPosition
      : course.institutionalPosition,
    hasRoadmap: localCourse?.hasRoadmap ?? false,
    canCreateRoadmap: localCourse
      ? localCourse.canCreateRoadmap
      : isComplete && isCourseLeadPosition(course.institutionalPosition),
  };
}

function projectOverviewCourses(
  mufasa: MufasaEnrolledCoursesResult,
  localCourses: AcademicOverviewCourse[],
) {
  if (mufasa.source === 'LOCAL') return localCourses;
  const localCoursesByKey = new Map(
    localCourses.map((course) => [academicOverviewCourseKey(course), course]),
  );
  const courses = mufasa.courses.map((course) =>
    courseFromMufasa(
      course,
      localCoursesByKey.get(academicOverviewCourseKey(course)),
      mufasa.isComplete !== false,
    ),
  );
  if (mufasa.isComplete === false) {
    const reported = new Set(courses.map(academicOverviewCourseKey));
    courses.push(
      ...localCourses.filter((course) => !reported.has(academicOverviewCourseKey(course))),
    );
  }
  return courses;
}

function apiOffering(course: AcademicOverviewCourse): AcademicOverviewApiOffering {
  return {
    courseCode: course.courseCode,
    name: course.name,
    year: course.year,
    semester: course.semester,
    section: course.section,
    department: course.department,
    role: course.role,
    institutionalPosition: course.institutionalPosition,
    hasRoadmap: course.hasRoadmap,
  };
}

export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
  source?: MufasaEnrolledCoursesResult,
): Promise<AcademicOverviewPage> {
  const { mufasa, localCourses } = await getAcademicOverview(actor, source);
  const courses = projectOverviewCourses(mufasa, localCourses);

  return {
    source: mufasa.source,
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  source?: MufasaEnrolledCoursesResult,
): Promise<AcademicOverviewApiResponse> {
  const { mufasa, localCourses } = await getAcademicOverview(actor, source);
  const offerings = projectOverviewCourses(mufasa, localCourses).map(apiOffering);

  return { source: mufasa.source, offerings };
}
