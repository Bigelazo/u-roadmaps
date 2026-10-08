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
  AcademicOverviewSources,
  RoadmapClosureCalendar,
} from '../types';

async function getAcademicOverview(
  actor: AcademicOverviewActor,
  { source, isPastClosure }: AcademicOverviewSources,
) {
  const [mufasa, localCourses] = await Promise.all([
    source ??
      getMufasaAcademicCourses(actor.rut, {
        useLocalFixtureData: actor.useLocalFixtureData === true,
      }),
    readLocalAcademicOverview(actor, isPastClosure),
  ]);
  return { mufasa, localCourses };
}

function courseFromMufasa(
  course: Awaited<ReturnType<typeof getMufasaAcademicCourses>>['courses'][number],
  localCourse: AcademicOverviewCourse | undefined,
  isComplete: boolean,
  isPastClosure: RoadmapClosureCalendar,
): AcademicOverviewCourse {
  const pastClosure = isPastClosure(course);
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
    isPastClosure: pastClosure,
    canCreateRoadmap: localCourse
      ? localCourse.canCreateRoadmap
      : isComplete && isCourseLeadPosition(course.institutionalPosition) && !pastClosure,
  };
}

function projectOverviewCourses(
  mufasa: MufasaEnrolledCoursesResult,
  localCourses: AcademicOverviewCourse[],
  isPastClosure: RoadmapClosureCalendar,
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
      isPastClosure,
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
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewPage> {
  const { mufasa, localCourses } = await getAcademicOverview(actor, sources);
  const courses = projectOverviewCourses(mufasa, localCourses, sources.isPastClosure);

  return {
    source: mufasa.source,
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewApiResponse> {
  const { mufasa, localCourses } = await getAcademicOverview(actor, sources);
  const offerings = projectOverviewCourses(mufasa, localCourses, sources.isPastClosure).map(
    apiOffering,
  );

  return { source: mufasa.source, offerings };
}
