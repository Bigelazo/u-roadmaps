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
