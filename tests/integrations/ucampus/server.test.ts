import { afterEach, expect, it, vi } from 'vitest';
import {
  createMufasaUCampus,
  getMufasaAcademicHistory,
  localFixtureUCampus,
  getMufasaCourseMembers,
  getMufasaPersonNames,
} from '@/integrations/ucampus/server';

const originalToken = process.env.MUFASA_TOKEN;
const originalBaseUrl = process.env.MUFASA_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  if (originalToken === undefined) delete process.env.MUFASA_TOKEN;
  else process.env.MUFASA_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.MUFASA_BASE_URL;
  else process.env.MUFASA_BASE_URL = originalBaseUrl;
});

type MufasaList = unknown[] | Response;

/** Answers each MUFASA course list; a list left out answers with no course. */
function stubCourseLists(lists: { enrolled?: MufasaList; taught?: MufasaList }) {
  const answer = (list: MufasaList = []) =>
    list instanceof Response ? list.clone() : new Response(JSON.stringify(list));
  const fetch = vi.fn((url: URL) =>
    Promise.resolve(
      answer(url.pathname.endsWith('/cursos_dictados') ? lists.taught : lists.enrolled),
    ),
  );
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

const enrolledCourse = {
  codigo: 'CC5002',
  nombre: 'Desarrollo de software',
  ano: 2026,
  periodo: 2,
};
const parsedEnrolledCourse = {
  courseCode: 'CC5002',
  name: 'Desarrollo de software',
  year: 2026,
  semester: 2,
  section: null,
  ramoId: null,
  isTeaching: false,
  institutionalPosition: 'STUDENT',
};

it('reads both course lists from MUFASA without exposing its token in the URL', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const fetch = stubCourseLists({ enrolled: [{ ...enrolledCourse, seccion: '1' }] });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({
    status: 'complete',
    courses: [{ ...parsedEnrolledCourse, section: '1' }],
  });
  expect(fetch.mock.calls.map(([url]) => url.toString())).toEqual([
    'https://mufasa.example.test/api/cursos_inscritos?rut=12345678&id_periodo=todos',
    'https://mufasa.example.test/api/cursos_dictados?rut=12345678&periodo=todos',
  ]);
  const [, options] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
  expect(options.headers).toEqual({
    Accept: 'application/json',
    Authorization: 'Bearer private-token',
  });
});

it('answers a partial history when MUFASA includes a course it cannot parse', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({
    enrolled: [
      enrolledCourse,
      { codigo: 'CC0000', nombre: 'Registro con período no compatible', ano: 2025, periodo: 3 },
    ],
  });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({
    status: 'partial',
    courses: [parsedEnrolledCourse],
  });
});

it('answers a partial history when exactly one course list fails', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({ enrolled: [enrolledCourse], taught: new Response('', { status: 503 }) });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({
    status: 'partial',
    courses: [parsedEnrolledCourse],
  });
});

it.each([
  ['fail', new Response('', { status: 503 })],
  ['return only invalid courses', [{ codigo: 'CC5002' }]],
])('answers an unavailable history when both course lists %s', async (_, list) => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({ enrolled: list, taught: list });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({ status: 'unavailable' });
});

it('answers an unavailable history without contacting MUFASA when no token or RUT is known', async () => {
  delete process.env.MUFASA_TOKEN;
  const fetch = stubCourseLists({ enrolled: [enrolledCourse] });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({ status: 'unavailable' });
  process.env.MUFASA_TOKEN = 'private-token';
  await expect(getMufasaAcademicHistory(null)).resolves.toEqual({ status: 'unavailable' });
  expect(fetch).not.toHaveBeenCalled();
});

it('still queries MUFASA in development when E2E fixtures are enabled', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('U_ROADMAPS_E2E_DATA', 'true');
  stubCourseLists({ enrolled: [enrolledCourse] });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toMatchObject({
    status: 'complete',
  });
});

it('shares one pair of MUFASA requests per RUT within one adapter instance', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  const fetch = stubCourseLists({ enrolled: [enrolledCourse] });
  const ucampus = createMufasaUCampus();

  const [first, concurrent] = await Promise.all([
    ucampus.getAcademicHistory('12345678'),
    ucampus.getAcademicHistory('12345678'),
  ]);
  const later = await ucampus.getAcademicHistory('12345678');

  expect(first).toEqual({ status: 'complete', courses: [parsedEnrolledCourse] });
  expect(concurrent).toBe(first);
  expect(later).toBe(first);
  expect(fetch).toHaveBeenCalledTimes(2);
  await createMufasaUCampus().getAcademicHistory('12345678');
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('remembers a failed history as unavailable for that adapter instance only', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  const failure = new Response('', { status: 503 });
  stubCourseLists({ enrolled: failure, taught: failure });
  const ucampus = createMufasaUCampus();
  await expect(ucampus.getAcademicHistory('12345678')).resolves.toEqual({ status: 'unavailable' });

  const fetch = stubCourseLists({ enrolled: [enrolledCourse] });
  await expect(ucampus.getAcademicHistory('12345678')).resolves.toEqual({ status: 'unavailable' });
  expect(fetch).not.toHaveBeenCalled();
  await expect(createMufasaUCampus().getAcademicHistory('12345678')).resolves.toMatchObject({
    status: 'complete',
  });
});

it('does not remember course members or person names', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  const fetch = vi.fn(() => Promise.resolve(new Response('[]')));
  vi.stubGlobal('fetch', fetch);
  const ucampus = createMufasaUCampus();

  await ucampus.getCourseMembers(675, { year: 2026, semester: 2 });
  await ucampus.getCourseMembers(675, { year: 2026, semester: 2 });
  await ucampus.getPersonNames(['12345678']);
  await ucampus.getPersonNames(['12345678']);
  expect(fetch).toHaveBeenCalledTimes(4);
});

it('keeps development fixture profiles on their local course offerings', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
  const fetch = stubCourseLists({ enrolled: [enrolledCourse] });

  await expect(localFixtureUCampus.getAcademicHistory('10000001')).resolves.toEqual({
    status: 'unavailable',
  });
  await expect(
    localFixtureUCampus.getCourseMembers(675, { year: 2026, semester: 2 }),
  ).resolves.toEqual({
    source: 'LOCAL',
    members: [],
  });
  await expect(localFixtureUCampus.getPersonNames(['10000001'])).resolves.toEqual(new Map());
  expect(fetch).not.toHaveBeenCalled();
});

it('queries MUFASA for a real user while development fixtures are enabled', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
  stubCourseLists({ enrolled: [enrolledCourse] });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({
    status: 'complete',
    courses: [parsedEnrolledCourse],
  });
});

it('identifies teaching positions returned alongside enrolled courses', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({
    enrolled: [
      { codigo: 'CC1001', nombre: 'Ayudantía', ano: 2026, periodo: 2, id_cargo: 3 },
      { codigo: 'CC1002', nombre: 'Auxiliaría', ano: 2026, periodo: 2, id_cargo: '2' },
      { codigo: 'CC1003', nombre: 'Cátedra', ano: 2026, periodo: 2, id_cargo: 1 },
      {
        codigo: 'CC1004',
        nombre: 'Coordinación',
        ano: 2026,
        periodo: 2,
        cargo: 'Profesor Coordinador',
      },
    ],
  });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toMatchObject({
    status: 'complete',
    courses: [
      { courseCode: 'CC1001', institutionalPosition: 'TEACHING_ASSISTANT' },
      { courseCode: 'CC1002', institutionalPosition: 'AUXILIARY_PROFESSOR' },
      { courseCode: 'CC1003', institutionalPosition: 'COURSE_PROFESSOR' },
      { courseCode: 'CC1004', institutionalPosition: 'COORDINATING_PROFESSOR' },
    ],
  });
});

it('combines enrolled and taught courses into a complete history', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({
    enrolled: [{ codigo: 'CC9002', nombre: 'Curso inscrito', ano: 2026, periodo: 2 }],
    taught: [{ codigo: 'CC9001', nombre: 'Curso dictado', ano: 2026, periodo: 2, id_cargo: 1 }],
  });

  await expect(getMufasaAcademicHistory('12345678')).resolves.toMatchObject({
    status: 'complete',
    courses: [
      { courseCode: 'CC9002', isTeaching: false },
      { courseCode: 'CC9001', isTeaching: true, institutionalPosition: 'COURSE_PROFESSOR' },
    ],
  });
});

it('answers a partial history when neither list includes a course', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  stubCourseLists({});

  await expect(getMufasaAcademicHistory('12345678')).resolves.toEqual({
    status: 'partial',
    courses: [],
  });
});

it('reads the U-Campus roster of every section in the requested Academic term only', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        { rut: 11111111, seccion: '1', id_periodo: '2026.2', id_cargo: 0, cargo: 'Alumno' },
        {
          rut: 22222222,
          seccion: '2',
          id_periodo: '2026.2',
          id_cargo: '1',
          cargo: 'Profesor de Cátedra',
        },
        { rut: 33333333, seccion: '1', id_periodo: '2026.2', id_cargo: '10', cargo: 'Oyente' },
        { rut: 44444444, seccion: '1', id_periodo: '2025.2', id_cargo: 0, cargo: 'Alumno' },
        { rut: 55555555, seccion: '1', id_periodo: '2026.2', id_cargo: 99, cargo: 'Desconocido' },
      ]),
    ),
  );
  vi.stubGlobal('fetch', fetch);

  await expect(getMufasaCourseMembers(675, { year: 2026, semester: 2 })).resolves.toEqual({
    source: 'MUFASA',
    members: [
      { rut: '11111111', section: '1', institutionalPosition: 'STUDENT' },
      { rut: '22222222', section: '2', institutionalPosition: 'COURSE_PROFESSOR' },
      { rut: '33333333', section: '1', institutionalPosition: 'OBSERVER' },
    ],
  });
  expect((fetch.mock.calls[0][0] as URL).toString()).toBe(
    'https://mufasa.example.test/api/integrantes?id_ramo=675&id_periodo=2026.2',
  );
});

it('reports an unavailable roster instead of an empty one when MUFASA fails', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));

  await expect(getMufasaCourseMembers(675, { year: 2026, semester: 2 })).resolves.toEqual({
    source: 'LOCAL',
    members: [],
  });
});

it('reads person names in batches and tolerates a failed batch', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const ruts = Array.from({ length: 51 }, (_, index) => String(10000000 + index));
  const fetch = vi.fn((url: URL) => {
    const requested = url.searchParams.get('rut')!.split(',');
    if (requested.length === 1) return Promise.resolve(new Response('', { status: 500 }));
    return Promise.resolve(
      new Response(
        JSON.stringify(
          requested.map((rut) => ({
            rut: Number(rut),
            nombre1: 'Ana',
            nombre2: 'María',
            apellido1: 'Pérez',
            apellido2: 'Soto',
          })),
        ),
      ),
    );
  });
  vi.stubGlobal('fetch', fetch);

  const names = await getMufasaPersonNames(ruts);

  expect(fetch).toHaveBeenCalledTimes(2);
  expect(names.size).toBe(50);
  expect(names.get('10000000')).toBe('Ana Pérez Soto');
  expect(names.has('10000050')).toBe(false);
});
