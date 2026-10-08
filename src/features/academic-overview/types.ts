export type AcademicOverviewActor = Readonly<{
  id: string;
  rut: string | null;
  useLocalFixtureData?: boolean;
}>;

export type AcademicOverviewSource = 'MUFASA' | 'LOCAL';

export type AcademicOverviewRole = 'STUDENT' | 'TEACHER';

export type AcademicOverviewInstitutionalPosition =
  import('@/shared/institutional-position').InstitutionalCoursePosition;

export type AcademicOverviewCourse = Readonly<{
  courseCode: string;
  name: string;
  department: string | null;
  year: number;
  semester: number;
  section: string | null;
  role: AcademicOverviewRole;
  institutionalPosition: AcademicOverviewInstitutionalPosition | null;
  hasRoadmap: boolean;
  /** Past its Roadmap closure instant: no Roadmap can be created for it any longer. */
  isPastClosure: boolean;
  canCreateRoadmap: boolean;
}>;

export type AcademicOverviewApiOffering = Omit<
  AcademicOverviewCourse,
  'canCreateRoadmap' | 'isPastClosure'
>;

/** Whether Course offerings of an Academic term are past their Roadmap closure instant. */
export type RoadmapClosureCalendar = (
  term: Readonly<{ year: number; semester: number }>,
) => boolean;

export type AcademicOverviewSources = Readonly<{
  /** The person's U-Campus courses when already read; otherwise they are read here. */
  source?: import('@/integrations/ucampus/server').MufasaEnrolledCoursesResult;
  isPastClosure: RoadmapClosureCalendar;
}>;

export type AcademicOverviewApiResponse = Readonly<{
  source: AcademicOverviewSource;
  offerings: AcademicOverviewApiOffering[];
}>;

export type AcademicOverviewTerm = Readonly<{
  year: number;
  semester: number;
  courses: AcademicOverviewCourse[];
}>;

export type AcademicOverviewPage = Readonly<{
  source: AcademicOverviewSource;
  terms: AcademicOverviewTerm[];
}>;
