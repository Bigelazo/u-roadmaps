import { afterEach, expect, it, vi } from 'vitest';
import { getMufasaEnrolledCourses } from '@/lib/mufasa';

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
    courses: [
      {
        courseCode: 'CC5002',
        name: 'Desarrollo de software',
        year: 2026,
        semester: 2,
        section: null,
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
    source: 'LOCAL',
    courses: [],
  });
});
