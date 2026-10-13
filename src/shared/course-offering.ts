/** Course offering identifier (GLOSSARY): canonical Course code and Academic term. */
export type CourseOfferingIdentifier = {
  courseCode: string;
  year: number;
  semester: number;
};

/** The Academic term's season label, e.g. "Otoño 2026". */
export function termLabel({ year, semester }: Pick<CourseOfferingIdentifier, 'year' | 'semester'>) {
  return `${semester === 1 ? 'Otoño' : 'Primavera'} ${year}`;
}

/** The teaching-staff page listing a Course offering's members and their Roadmap progress. */
export function courseParticipantsUrl({ courseCode, year, semester }: CourseOfferingIdentifier) {
  return `/courses/${encodeURIComponent(courseCode)}/${year}/${semester}/participants`;
}
