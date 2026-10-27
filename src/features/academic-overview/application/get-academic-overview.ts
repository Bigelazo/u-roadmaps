import 'server-only';

import {
  type MufasaEnrolledCourse,
  isCourseLeadPosition,
  isTeachingPosition,
  type AcademicHistory,
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
  AcademicOverviewSource,
  AcademicOverviewSources,
  RoadmapClosureCalendar,
} from '../types';

/** The public `source` field: any U-Campus answer, complete or partial, reads as MUFASA. */
function overviewSource(history: AcademicHistory): AcademicOverviewSource {
  return history.status === 'unavailable' ? 'LOCAL' : 'MUFASA';
}

function courseFromMufasa(
  course: MufasaEnrolledCourse,
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
    progress: localCourse?.progress ?? null,
    isPastClosure: pastClosure,
    canCreateRoadmap: localCourse
      ? localCourse.canCreateRoadmap
      : isComplete && isCourseLeadPosition(course.institutionalPosition) && !pastClosure,
  };
}

function projectOverviewCourses(
  history: AcademicHistory,
  localCourses: AcademicOverviewCourse[],
  isPastClosure: RoadmapClosureCalendar,
) {
  if (history.status === 'unavailable') return localCourses;
  const localCoursesByKey = new Map(
    localCourses.map((course) => [academicOverviewCourseKey(course), course]),
  );
  const courses = history.courses.map((course) =>
    courseFromMufasa(
      course,
      localCoursesByKey.get(academicOverviewCourseKey(course)),
      history.status === 'complete',
      isPastClosure,
    ),
  );
  if (history.status === 'partial') {
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

/** Reads the local overview and projects the Academic history over it, for both entry points. */
async function readAcademicOverview(
  actor: AcademicOverviewActor,
  { history, isPastClosure }: AcademicOverviewSources,
) {
  const localCourses = await readLocalAcademicOverview(actor, isPastClosure);
  return {
    source: overviewSource(history),
    courses: projectOverviewCourses(history, localCourses, isPastClosure),
  };
}

export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewPage> {
  const { source, courses } = await readAcademicOverview(actor, sources);
  return {
    source,
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewApiResponse> {
  const { source, courses } = await readAcademicOverview(actor, sources);
  return { source, offerings: courses.map(apiOffering) };
}
