import 'server-only';

import { getMufasaAcademicCourses, isCourseLeadPosition } from '@/integrations/ucampus/server';
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

async function getAcademicOverview(actor: AcademicOverviewActor) {
  const [mufasa, localCourses] = await Promise.all([
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
): AcademicOverviewCourse {
  return {
    courseCode: course.courseCode,
    name: course.name,
    year: course.year,
    semester: course.semester,
    section: course.section,
    department: localCourse?.department ?? null,
    role:
      course.isTeaching ||
      (course.institutionalPosition !== null && course.institutionalPosition !== 'OBSERVER')
        ? 'TEACHER'
        : (localCourse?.role ?? 'STUDENT'),
    institutionalPosition: course.institutionalPosition,
    hasRoadmap: localCourse?.hasRoadmap ?? false,
    canCreateRoadmap: isCourseLeadPosition(course.institutionalPosition),
  };
}

function apiOfferingFromMufasa(course: AcademicOverviewCourse): AcademicOverviewApiOffering {
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

function apiOfferingFromLocal(course: AcademicOverviewCourse): AcademicOverviewApiOffering {
  return {
    courseCode: course.courseCode,
    name: course.name,
    department: course.department,
    year: course.year,
    semester: course.semester,
    section: course.section,
    role: course.role,
    institutionalPosition: course.institutionalPosition,
    hasRoadmap: course.hasRoadmap,
  };
}

export async function getAcademicOverviewPage(
  actor: AcademicOverviewActor,
): Promise<AcademicOverviewPage> {
  const { mufasa, localCourses } = await getAcademicOverview(actor);
  const localCoursesByKey = new Map(
    localCourses.map((course) => [academicOverviewCourseKey(course), course]),
  );
  const courses =
    mufasa.source === 'MUFASA'
      ? mufasa.courses.map((course) =>
          courseFromMufasa(course, localCoursesByKey.get(academicOverviewCourseKey(course))),
        )
      : localCourses;

  return {
    source: mufasa.source,
    terms: groupAcademicOverviewCoursesByAcademicTerm(uniqueAcademicOverviewCourses(courses)),
  };
}

export async function getAcademicOverviewApi(
  actor: AcademicOverviewActor,
): Promise<AcademicOverviewApiResponse> {
  const { mufasa, localCourses } = await getAcademicOverview(actor);
  const localCoursesByKey = new Map(
    localCourses.map((course) => [academicOverviewCourseKey(course), course]),
  );
  const offerings =
    mufasa.source === 'MUFASA'
      ? mufasa.courses.map((course) => {
          return apiOfferingFromMufasa(
            courseFromMufasa(course, localCoursesByKey.get(academicOverviewCourseKey(course))),
          );
        })
      : localCourses.map(apiOfferingFromLocal);

  return { source: mufasa.source, offerings };
}
