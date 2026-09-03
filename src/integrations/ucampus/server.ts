import 'server-only';

export type MufasaInstitutionalCoursePosition =
  | 'TEACHING_ASSISTANT'
  | 'AUXILIARY_PROFESSOR'
  | 'COURSE_PROFESSOR'
  | 'COORDINATING_PROFESSOR'
  | 'OBSERVER';

export type MufasaEnrolledCourse = Readonly<{
  courseCode: string;
  name: string;
  year: number;
  semester: 1 | 2;
  section: string | null;
  isTeaching: boolean;
  institutionalPosition: MufasaInstitutionalCoursePosition | null;
}>;

export type MufasaEnrolledCoursesResult =
  | Readonly<{ source: 'MUFASA'; courses: MufasaEnrolledCourse[] }>
  | Readonly<{ source: 'LOCAL'; courses: [] }>;

type GetMufasaEnrolledCoursesOptions = Readonly<{
  useLocalFixtureData?: boolean;
}>;

const defaultMufasaBaseUrl = 'https://apps.dcc.uchile.cl/servicios/puente/ucampus/api/fcfm_mufasa';

function configuredBaseUrl() {
  return process.env.MUFASA_BASE_URL ?? defaultMufasaBaseUrl;
}

function nonEmptyString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = nonEmptyString(record[key]);
    if (value) return value;
  }
  return null;
}

function readInteger(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    const parsed =
      typeof value === 'number' ? value : typeof value === 'string' ? Number(value.trim()) : NaN;
    if (Number.isInteger(parsed)) return parsed;
  }
  return null;
}

function enrolledCoursesPayload(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (!value || typeof value !== 'object') throw new Error('MUFASA returned an invalid payload.');

  const record = value as Record<string, unknown>;
  for (const key of ['cursos', 'courses', 'data']) {
    if (Array.isArray(record[key])) return record[key];
  }
  throw new Error('MUFASA returned an invalid enrolled-courses payload.');
}

function institutionalPosition(
  course: Record<string, unknown>,
): MufasaInstitutionalCoursePosition | null {
  switch (readInteger(course, ['id_cargo', 'cargo_id'])) {
    case 1:
      return 'COURSE_PROFESSOR';
    case 2:
      return 'AUXILIARY_PROFESSOR';
    case 3:
      return 'TEACHING_ASSISTANT';
    case 6:
      return 'COORDINATING_PROFESSOR';
  }

  const cargo = readString(course, ['cargo', 'position', 'rol'])
    ?.normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('es-CL');
  switch (cargo) {
    case 'ayudante':
      return 'TEACHING_ASSISTANT';
    case 'auxiliar':
    case 'profesor auxiliar':
      return 'AUXILIARY_PROFESSOR';
    case 'catedra':
    case 'profesor de catedra':
      return 'COURSE_PROFESSOR';
    case 'profesor coordinador':
      return 'COORDINATING_PROFESSOR';
    case 'oyente':
      return 'OBSERVER';
    default:
      return null;
  }
}

function parseCourse(value: unknown, isTeaching: boolean): MufasaEnrolledCourse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('MUFASA returned an invalid enrolled course.');
  }
  const course = value as Record<string, unknown>;
  const courseCode = readString(course, ['codigo', 'course_code', 'cod_curso']);
  const name = readString(course, ['nombre', 'course_name', 'nombre_curso']);
  const year = readInteger(course, ['ano', 'anio', 'year']);
  const semester = readInteger(course, ['periodo', 'semestre', 'semester']);
  const section = readString(course, ['seccion', 'section']);

  if (!courseCode || !name || !year || (semester !== 1 && semester !== 2)) {
    throw new Error('MUFASA returned a course without a valid academic term.');
  }

  return {
    courseCode,
    name,
    year,
    semester,
    section,
    isTeaching,
    institutionalPosition: institutionalPosition(course),
  };
}

async function getMufasaCourses(
  rut: string | null,
  endpoint: 'cursos_dictados' | 'cursos_inscritos',
  isTeaching: boolean,
  { useLocalFixtureData = false }: GetMufasaEnrolledCoursesOptions = {},
): Promise<MufasaEnrolledCoursesResult> {
  const token = process.env.MUFASA_TOKEN;
  if (
    !rut ||
    !token ||
    useLocalFixtureData ||
    (process.env.NODE_ENV === 'production' && process.env.U_ROADMAPS_E2E_DATA === 'true')
  ) {
    return { source: 'LOCAL', courses: [] };
  }

  try {
    const url = new URL(endpoint, `${configuredBaseUrl().replace(/\/$/, '')}/`);
    url.searchParams.set('rut', rut);
    if (endpoint === 'cursos_inscritos') url.searchParams.set('id_periodo', 'todos');
    else url.searchParams.set('periodo', 'todos');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`MUFASA returned HTTP ${response.status}.`);

    const payload: unknown = await response.json();
    const remoteCourses = enrolledCoursesPayload(payload);
    const courses = remoteCourses.flatMap((course) => {
      try {
        return [parseCourse(course, isTeaching)];
      } catch {
        // Historical snapshots can include periods that the overview cannot represent.
        // Keep the valid portion of an otherwise successful Mufasa response.
        return [];
      }
    });
    if (remoteCourses.length > 0 && courses.length === 0) {
      throw new Error('MUFASA returned no valid courses.');
    }
    return { source: 'MUFASA', courses };
  } catch {
    // The overview remains useful with materialized offerings during a remote outage.
    return { source: 'LOCAL', courses: [] };
  }
}

/** Gets the authenticated person's enrolled U-Campus courses. */
export function getMufasaEnrolledCourses(
  rut: string | null,
  options: GetMufasaEnrolledCoursesOptions = {},
): Promise<MufasaEnrolledCoursesResult> {
  return getMufasaCourses(rut, 'cursos_inscritos', false, options);
}

/** Gets the U-Campus course offerings taught by the authenticated person. */
export function getMufasaTaughtCourses(
  rut: string | null,
  options: GetMufasaEnrolledCoursesOptions = {},
): Promise<MufasaEnrolledCoursesResult> {
  return getMufasaCourses(rut, 'cursos_dictados', true, options);
}

/**
 * Gets both U-Campus lists needed for the academic overview. A successful
 * endpoint remains useful if the other list is temporarily unavailable.
 */
export async function getMufasaAcademicCourses(
  rut: string | null,
  options: GetMufasaEnrolledCoursesOptions = {},
): Promise<MufasaEnrolledCoursesResult> {
  const [enrolled, taught] = await Promise.all([
    getMufasaEnrolledCourses(rut, options),
    getMufasaTaughtCourses(rut, options),
  ]);
  if (enrolled.source === 'LOCAL' && taught.source === 'LOCAL')
    return { source: 'LOCAL', courses: [] };

  return { source: 'MUFASA', courses: [...enrolled.courses, ...taught.courses] };
}
