export type AcademicOverviewActor = Readonly<{
  id: string;
  rut: string | null;
  useLocalFixtureData?: boolean;
}>;

export type AcademicOverviewSource = 'MUFASA' | 'LOCAL';

export type AcademicOverviewRole = 'STUDENT' | 'TEACHER';

export type AcademicOverviewInstitutionalPosition =
  | 'TEACHING_ASSISTANT'
  | 'AUXILIARY_PROFESSOR'
  | 'COURSE_PROFESSOR'
  | 'COORDINATING_PROFESSOR'
  | 'OBSERVER';

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
  canCreateRoadmap: boolean;
}>;

export type AcademicOverviewApiOffering = Omit<AcademicOverviewCourse, 'canCreateRoadmap'>;

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
