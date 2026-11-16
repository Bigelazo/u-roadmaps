export type CourseOfferingIdentifier = {
  courseCode: string;
  year: number;
  semester: number;
};

export function termLabel({ year, semester }: Pick<CourseOfferingIdentifier, 'year' | 'semester'>) {
  return `${semester === 1 ? 'Otoño' : 'Primavera'} ${year}`;
}

export function courseParticipantsUrl({ courseCode, year, semester }: CourseOfferingIdentifier) {
  return `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}/participants`;
}

export type CourseOfferingIdentifierParams = Readonly<{
  courseCode: string;
  year: string;
  semester: string;
}>;

export function parseCourseCode(param: string): string | null {
  let courseCode: string;
  try {
    courseCode = decodeURIComponent(param).trim();
  } catch {
    return null;
  }
  return courseCode && courseCode.length <= 20 ? courseCode : null;
}

export function parseCourseOfferingIdentifier(
  params: CourseOfferingIdentifierParams,
): CourseOfferingIdentifier | null {
  const courseCode = parseCourseCode(params.courseCode);
  const year = Number(params.year);
  const semester = Number(params.semester);

  if (
    !courseCode ||
    !Number.isInteger(year) ||
    year < 1 ||
    !Number.isInteger(semester) ||
    ![1, 2].includes(semester)
  ) {
    return null;
  }

  return { courseCode, year, semester };
}
