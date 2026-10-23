import { afterEach, expect, it, vi } from 'vitest';
import {
  getMufasaAcademicCourses,
  localFixtureUCampus,
  getMufasaCourseMembers,
  getMufasaEnrolledCourses,
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

it('reads enrolled courses from MUFASA without exposing its token in the URL', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const fetch = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify([
        {
          codigo: 'CC5002',
          nombre: 'Desarrollo de software',
          ano: 2026,
          periodo: 2,
          seccion: '1',
        },
      ]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    ),
  );
  vi.stubGlobal('fetch', fetch);

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toEqual({
    source: 'MUFASA',
    courses: [
      {
        courseCode: 'CC5002',
        name: 'Desarrollo de software',
        year: 2026,
        semester: 2,
        section: '1',
        ramoId: null,
        isTeaching: false,
        institutionalPosition: 'STUDENT',
      },
    ],
  });
  const [url, options] = fetch.mock.calls[0] as [URL, RequestInit];
  expect(url.toString()).toBe(
    'https://mufasa.example.test/api/cursos_inscritos?rut=12345678&id_periodo=todos',
  );
  expect(options.headers).toEqual({
    Accept: 'application/json',
    Authorization: 'Bearer private-token',
  });
});

it('keeps valid enrolled courses when MUFASA includes a course with an unsupported period', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
          {
            codigo: 'CC5002',
            nombre: 'Desarrollo de software',
            ano: 2026,
            periodo: 2,
          },
          {
            codigo: 'CC0000',
            nombre: 'Registro con período no compatible',
            ano: 2025,
            periodo: 3,
          },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ),
  );

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toEqual({
    source: 'MUFASA',
    isComplete: false,
    courses: [
      {
        courseCode: 'CC5002',
        name: 'Desarrollo de software',
        year: 2026,
        semester: 2,
        section: null,
        ramoId: null,
        isTeaching: false,
        institutionalPosition: 'STUDENT',
      },
    ],
  });
});

it('falls back to local offerings when MUFASA is unavailable or returns an invalid snapshot', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(new Response(JSON.stringify([{ codigo: 'CC5002' }]))),
  );

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toEqual({
    source: 'LOCAL',
    courses: [],
  });
});

it('still queries MUFASA in development when E2E fixtures are enabled', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('U_ROADMAPS_E2E_DATA', 'true');
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { codigo: 'CC5002', nombre: 'Desarrollo de software', ano: 2026, periodo: 2 },
          ]),
        ),
      ),
  );

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toMatchObject({
    source: 'MUFASA',
  });
});

it('keeps development fixture profiles on their local course offerings', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('U_ROADMAPS_DEV_DATA', 'true');
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify([
          { codigo: 'CC5002', nombre: 'Desarrollo de software', ano: 2026, periodo: 2 },
        ]),
      ),
    );
  vi.stubGlobal('fetch', fetch);

  await expect(localFixtureUCampus.getAcademicCourses('10000001')).resolves.toEqual({
    source: 'LOCAL',
    courses: [],
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
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockResolvedValue(
        new Response(
          JSON.stringify([
            { codigo: 'CC5002', nombre: 'Desarrollo de software', ano: 2026, periodo: 2 },
          ]),
        ),
      ),
  );

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toEqual({
    source: 'MUFASA',
    courses: [
      {
        courseCode: 'CC5002',
        name: 'Desarrollo de software',
        year: 2026,
        semester: 2,
        section: null,
        ramoId: null,
        isTeaching: false,
        institutionalPosition: 'STUDENT',
      },
    ],
  });
});

it('identifies teaching positions returned alongside enrolled courses', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify([
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
        ]),
      ),
    ),
  );

  await expect(getMufasaEnrolledCourses('12345678')).resolves.toMatchObject({
    source: 'MUFASA',
    courses: [
      { courseCode: 'CC1001', institutionalPosition: 'TEACHING_ASSISTANT' },
      { courseCode: 'CC1002', institutionalPosition: 'AUXILIARY_PROFESSOR' },
      { courseCode: 'CC1003', institutionalPosition: 'COURSE_PROFESSOR' },
      { courseCode: 'CC1004', institutionalPosition: 'COORDINATING_PROFESSOR' },
    ],
  });
});

it('combines enrolled and taught courses for the academic overview', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const fetch = vi.fn((url: URL) => {
    if (url.pathname.endsWith('/cursos_dictados')) {
      return Promise.resolve(
        new Response(
          JSON.stringify([
            {
              codigo: 'CC9001',
              nombre: 'Curso dictado',
              ano: 2026,
              periodo: 2,
              id_cargo: 1,
            },
          ]),
        ),
      );
    }
    return Promise.resolve(
      new Response(
        JSON.stringify([{ codigo: 'CC9002', nombre: 'Curso inscrito', ano: 2026, periodo: 2 }]),
      ),
    );
  });
  vi.stubGlobal('fetch', fetch);

  await expect(getMufasaAcademicCourses('12345678')).resolves.toMatchObject({
    source: 'MUFASA',
    courses: [
      { courseCode: 'CC9002', isTeaching: false },
      {
        courseCode: 'CC9001',
        isTeaching: true,
        institutionalPosition: 'COURSE_PROFESSOR',
      },
    ],
  });
  expect(fetch.mock.calls.map(([url]) => (url as URL).toString())).toEqual([
    'https://mufasa.example.test/api/cursos_inscritos?rut=12345678&id_periodo=todos',
    'https://mufasa.example.test/api/cursos_dictados?rut=12345678&periodo=todos',
  ]);
});

it('treats a history that lists no course in either list as incomplete', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response('[]'))),
  );

  await expect(getMufasaAcademicCourses('12345678')).resolves.toEqual({
    source: 'MUFASA',
    courses: [],
    isComplete: false,
  });
});

it('keeps a history complete when only one of its lists is empty', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  vi.stubGlobal(
    'fetch',
    vi.fn((url: URL) =>
      Promise.resolve(
        new Response(
          url.pathname.endsWith('/cursos_dictados')
            ? JSON.stringify([
                { codigo: 'CC9001', nombre: 'Curso dictado', ano: 2026, periodo: 2, id_cargo: 1 },
              ])
            : '[]',
        ),
      ),
    ),
  );

  await expect(getMufasaAcademicCourses('12345678')).resolves.toMatchObject({
    source: 'MUFASA',
    courses: [{ courseCode: 'CC9001' }],
    isComplete: true,
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
