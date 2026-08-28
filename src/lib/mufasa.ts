import { developmentEnvironmentEnabled } from '@/lib/development';

export type MufasaEnrolledCourse = Readonly<{
  courseCode: string;
  name: string;
  year: number;
  semester: 1 | 2;
  section: string | null;
}>;

export type MufasaEnrolledCoursesResult =
  | Readonly<{ source: 'MUFASA'; courses: MufasaEnrolledCourse[] }>
  | Readonly<{ source: 'LOCAL'; courses: [] }>;

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

function parseEnrolledCourse(value: unknown): MufasaEnrolledCourse {
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

  return { courseCode, name, year, semester, section };
}

/**
 * Gets the authenticated student's academic history. The token and the U-Campus
 * response remain on the server; callers receive only the fields needed by the
 * academic overview.
 */
export async function getMufasaEnrolledCourses(
  rut: string | null,
): Promise<MufasaEnrolledCoursesResult> {
  const token = process.env.MUFASA_TOKEN;
  if (
    !rut ||
    !token ||
    developmentEnvironmentEnabled() ||
    (process.env.NODE_ENV === 'production' && process.env.U_ROADMAPS_E2E_DATA === 'true')
  ) {
    return { source: 'LOCAL', courses: [] };
  }

  try {
    const url = new URL('cursos_inscritos', `${configuredBaseUrl().replace(/\/$/, '')}/`);
    url.searchParams.set('rut', rut);
    url.searchParams.set('id_periodo', 'todos');
    const response = await fetch(url, {
      headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`MUFASA returned HTTP ${response.status}.`);

    const payload: unknown = await response.json();
    const enrolledCourses = enrolledCoursesPayload(payload);
    const courses = enrolledCourses.flatMap((course) => {
      try {
        return [parseEnrolledCourse(course)];
      } catch {
        // Historical snapshots can include periods that the overview cannot represent.
        // Keep the valid portion of an otherwise successful Mufasa response.
        return [];
      }
    });
    if (enrolledCourses.length > 0 && courses.length === 0) {
      throw new Error('MUFASA returned no valid enrolled courses.');
    }
    return { source: 'MUFASA', courses };
  } catch {
    // The overview remains useful with materialized offerings during a remote outage.
    return { source: 'LOCAL', courses: [] };
  }
}
