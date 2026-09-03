import type {
  AcademicOverviewCourse,
  AcademicOverviewInstitutionalPosition,
  AcademicOverviewTerm,
} from '../types';

const institutionalPositionPriorities: Record<AcademicOverviewInstitutionalPosition, number> = {
  COORDINATING_PROFESSOR: 1,
  COURSE_PROFESSOR: 2,
  AUXILIARY_PROFESSOR: 3,
  TEACHING_ASSISTANT: 4,
  OBSERVER: 6,
};

export function academicOverviewCourseKey(
  course: Pick<AcademicOverviewCourse, 'courseCode' | 'year' | 'semester'>,
) {
  return `${course.courseCode}:${course.year}:${course.semester}`;
}

function coursePriority(course: AcademicOverviewCourse) {
  if (course.institutionalPosition) {
    return institutionalPositionPriorities[course.institutionalPosition];
  }
  return course.role === 'TEACHER' ? 4 : 5;
}

export function uniqueAcademicOverviewCourses(courses: AcademicOverviewCourse[]) {
  const coursesByKey = new Map<string, AcademicOverviewCourse>();
  for (const course of courses) {
    const existing = coursesByKey.get(academicOverviewCourseKey(course));
    if (!existing || coursePriority(course) < coursePriority(existing)) {
      coursesByKey.set(academicOverviewCourseKey(course), course);
    }
  }

  return Array.from(coursesByKey.values()).toSorted(
    (left, right) =>
      right.year - left.year ||
      right.semester - left.semester ||
      coursePriority(left) - coursePriority(right) ||
      left.courseCode.localeCompare(right.courseCode, 'es-CL'),
  );
}

export function groupAcademicOverviewCoursesByAcademicTerm(
  courses: AcademicOverviewCourse[],
): AcademicOverviewTerm[] {
  const termsByKey = new Map<string, AcademicOverviewTerm>();

  for (const course of courses) {
    const key = `${course.year}-${course.semester}`;
    const term = termsByKey.get(key);

    if (term) {
      term.courses.push(course);
    } else {
      termsByKey.set(key, { year: course.year, semester: course.semester, courses: [course] });
    }
  }

  return Array.from(termsByKey.values());
}
