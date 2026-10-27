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
  AcademicOverviewSources,
  RoadmapClosureCalendar,
} from '../types';

async function getAcademicOverview(
  actor: AcademicOverviewActor,
  { history: synchronized, isPastClosure }: AcademicOverviewSources,
) {
  const [history, localCourses] = await Promise.all([
    synchronized ?? actor.ucampus.getAcademicHistory(actor.rut),
    readLocalAcademicOverview(actor, isPastClosure),
  ]);
  return { history, localCourses };
}

/** The public `source` field: any U-Campus answer, complete or partial, reads as MUFASA. */
function overviewSource(history: AcademicHistory) {
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

export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewPage> {
  const { history, localCourses } = await getAcademicOverview(actor, sources);
  const courses = projectOverviewCourses(history, localCourses, sources.isPastClosure);

  return {
    source: overviewSource(history),
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
  sources: AcademicOverviewSources,
): Promise<AcademicOverviewApiResponse> {
  const { history, localCourses } = await getAcademicOverview(actor, sources);
  const offerings = projectOverviewCourses(history, localCourses, sources.isPastClosure).map(
    apiOffering,
  );

  return { source: overviewSource(history), offerings };
}
