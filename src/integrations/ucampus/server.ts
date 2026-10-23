import 'server-only';

import {
  positionCapabilities,
  type InstitutionalCoursePosition,
} from '@/shared/institutional-position';

export type MufasaInstitutionalCoursePosition = InstitutionalCoursePosition;
export function isCourseLeadPosition(position: InstitutionalCoursePosition | null) {
  return positionCapabilities(position).canCreateRoadmap;
}
export function isTeachingPosition(position: InstitutionalCoursePosition | null) {
  return positionCapabilities(position).isTeachingStaff;
}

export type MufasaEnrolledCourse = Readonly<{
  courseCode: string;
  name: string;
  year: number;
  semester: 1 | 2;
  section: string | null;
  ramoId: number | null;
  isTeaching: boolean;
  institutionalPosition: MufasaInstitutionalCoursePosition | null;
}>;

export type MufasaEnrolledCoursesResult =
  | Readonly<{ source: 'MUFASA'; courses: MufasaEnrolledCourse[]; isComplete?: boolean }>
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
    case 10:
      return 'OBSERVER';
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
    ramoId: readInteger(course, ['id_ramo']),
    isTeaching,
    institutionalPosition: institutionalPosition(course) ?? (isTeaching ? null : 'STUDENT'),
  };
}

async function requestMufasa(endpoint: string, params: Record<string, string>): Promise<unknown> {
  const token = process.env.MUFASA_TOKEN;
  if (!token) return null;
  const url = new URL(endpoint, `${configuredBaseUrl().replace(/\/$/, '')}/`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  const response = await fetch(url, {
    headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`MUFASA returned HTTP ${response.status}.`);
  return response.json();
}

async function getMufasaCourses(
  rut: string | null,
  endpoint: 'cursos_dictados' | 'cursos_inscritos',
  isTeaching: boolean,
): Promise<MufasaEnrolledCoursesResult> {
  if (!rut) return { source: 'LOCAL', courses: [] };

  try {
    const payload = await requestMufasa(
      endpoint,
      endpoint === 'cursos_inscritos' ? { rut, id_periodo: 'todos' } : { rut, periodo: 'todos' },
    );
    if (payload === null) return { source: 'LOCAL', courses: [] };
    const remoteCourses = enrolledCoursesPayload(payload);
    const courses = remoteCourses.flatMap((course) => {
      try {
        return [parseCourse(course, isTeaching)];
      } catch {
        return [];
      }
    });
    if (remoteCourses.length > 0 && courses.length === 0) {
      throw new Error('MUFASA returned no valid courses.');
    }
    return {
      source: 'MUFASA',
      courses,
      ...(courses.length !== remoteCourses.length ? { isComplete: false } : {}),
    };
  } catch {
    return { source: 'LOCAL', courses: [] };
  }
}

export function getMufasaEnrolledCourses(rut: string | null): Promise<MufasaEnrolledCoursesResult> {
  return getMufasaCourses(rut, 'cursos_inscritos', false);
}

export function getMufasaTaughtCourses(rut: string | null): Promise<MufasaEnrolledCoursesResult> {
  return getMufasaCourses(rut, 'cursos_dictados', true);
}

export async function getMufasaAcademicCourses(
  rut: string | null,
): Promise<MufasaEnrolledCoursesResult> {
  const [enrolled, taught] = await Promise.all([
    getMufasaEnrolledCourses(rut),
    getMufasaTaughtCourses(rut),
  ]);
  if (enrolled.source === 'LOCAL' && taught.source === 'LOCAL')
    return { source: 'LOCAL', courses: [] };

  const courses = [...enrolled.courses, ...taught.courses];
  return {
    source: 'MUFASA',
    courses,
    isComplete:
      courses.length > 0 &&
      enrolled.source === 'MUFASA' &&
      taught.source === 'MUFASA' &&
      enrolled.isComplete !== false &&
      taught.isComplete !== false,
  };
}

export type MufasaCourseMember = Readonly<{
  rut: string;
  section: string | null;
  institutionalPosition: MufasaInstitutionalCoursePosition;
}>;

export type MufasaCourseMembersResult =
  | Readonly<{ source: 'MUFASA'; members: MufasaCourseMember[] }>
  | Readonly<{ source: 'LOCAL'; members: [] }>;

function parseCourseMember(value: unknown): MufasaCourseMember | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const member = value as Record<string, unknown>;
  const rut = readInteger(member, ['rut']);
  const isStudent =
    readInteger(member, ['id_cargo']) === 0 ||
    readString(member, ['cargo'])?.toLocaleLowerCase('es-CL') === 'alumno';
  const position = institutionalPosition(member) ?? (isStudent ? 'STUDENT' : null);
  if (!rut || !position) return null;
  return {
    rut: String(rut),
    section: readString(member, ['seccion', 'section']),
    institutionalPosition: position,
  };
}

export async function getMufasaCourseMembers(
  ramoId: number,
  { year, semester }: Readonly<{ year: number; semester: number }>,
): Promise<MufasaCourseMembersResult> {
  const term = `${year}.${semester}`;
  try {
    const payload = await requestMufasa('integrantes', {
      id_ramo: String(ramoId),
      id_periodo: term,
    });
    if (payload === null) return { source: 'LOCAL', members: [] };
    if (!Array.isArray(payload)) throw new Error('MUFASA returned an invalid members payload.');
    const members = payload.flatMap((row) => {
      if (!row || typeof row !== 'object') return [];
      const record = row as Record<string, unknown>;
      const rowTerm =
        readString(record, ['id_periodo']) ??
        `${readInteger(record, ['ano'])}.${readInteger(record, ['periodo'])}`;
      if (rowTerm !== term) return [];
      const member = parseCourseMember(row);
      return member ? [member] : [];
    });
    return { source: 'MUFASA', members };
  } catch {
    return { source: 'LOCAL', members: [] };
  }
}

function personName(record: Record<string, unknown>) {
  const name = [
    readString(record, ['nombre1']),
    readString(record, ['apellido1']),
    readString(record, ['apellido2']),
  ]
    .filter(Boolean)
    .join(' ');
  return name || readString(record, ['alias']);
}

export async function getMufasaPersonNames(ruts: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const unique = [...new Set(ruts)];
  const batches = Array.from({ length: Math.ceil(unique.length / 50) }, (_, index) =>
    unique.slice(index * 50, index * 50 + 50),
  );
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const payload = await requestMufasa('personas', { rut: batch.join(',') });
        const people = Array.isArray(payload) ? payload : payload ? [payload] : [];
        for (const person of people) {
          if (!person || typeof person !== 'object') continue;
          const record = person as Record<string, unknown>;
          const rut = readInteger(record, ['rut']);
          const name = personName(record);
          if (rut && name) names.set(String(rut), name);
        }
      } catch {
        // Unnamed members are still listed by the caller.
      }
    }),
  );
  return names;
}

/** The U-Campus seam. LOCAL results preserve existing local Participations. */
export type UCampus = Readonly<{
  getAcademicCourses(rut: string | null): Promise<MufasaEnrolledCoursesResult>;
  getCourseMembers(
    ramoId: number,
    term: Readonly<{ year: number; semester: number }>,
  ): Promise<MufasaCourseMembersResult>;
  getPersonNames(ruts: readonly string[]): Promise<Map<string, string>>;
}>;

export const mufasaUCampus: UCampus = {
  getAcademicCourses: getMufasaAcademicCourses,
  getCourseMembers: getMufasaCourseMembers,
  getPersonNames: getMufasaPersonNames,
};

export const localFixtureUCampus: UCampus = {
  async getAcademicCourses() {
    return { source: 'LOCAL', courses: [] };
  },
  async getCourseMembers() {
    return { source: 'LOCAL', members: [] };
  },
  async getPersonNames() {
    return new Map();
  },
};
