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
