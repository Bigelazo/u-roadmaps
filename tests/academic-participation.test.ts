import { afterEach, expect, it, vi } from 'vitest';

// La política de cargos no toca la base de datos; el cliente Prisma exige una
// conexión al importarse.
vi.mock('@/lib/db', () => ({ prisma: {} }));

import {
  academicRole,
  canCreateRoadmap,
  canEditRoadmap,
  getMufasaCourseAccess,
  isRoadmapCreationPosition,
} from '@/lib/academic-participation';

const originalToken = process.env.MUFASA_TOKEN;
const originalBaseUrl = process.env.MUFASA_BASE_URL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalToken === undefined) delete process.env.MUFASA_TOKEN;
  else process.env.MUFASA_TOKEN = originalToken;
  if (originalBaseUrl === undefined) delete process.env.MUFASA_BASE_URL;
  else process.env.MUFASA_BASE_URL = originalBaseUrl;
});

const identifier = { courseCode: 'CC3002', year: 2026, semester: 2 };
const user = { id: '11111111-1111-4111-8111-111111111111', rut: '19039752' };

function mufasaResponse(courses: Array<Record<string, unknown>>) {
  return new Response(JSON.stringify(courses), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

it('reserves roadmap creation for the course and coordinating professors', () => {
  expect(isRoadmapCreationPosition('COURSE_PROFESSOR')).toBe(true);
  expect(isRoadmapCreationPosition('COORDINATING_PROFESSOR')).toBe(true);
  for (const position of ['AUXILIARY_PROFESSOR', 'TEACHING_ASSISTANT', 'OBSERVER', null] as const) {
    expect(isRoadmapCreationPosition(position)).toBe(false);
  }
});

it('extends roadmap editing to auxiliary professors and no further', () => {
  const access = (position: string) => ({ name: 'Curso', positions: [position] as never });

  expect(canEditRoadmap(access('AUXILIARY_PROFESSOR'))).toBe(true);
  expect(canCreateRoadmap(access('AUXILIARY_PROFESSOR'))).toBe(false);
  expect(academicRole(access('AUXILIARY_PROFESSOR'))).toBe('TEACHER');
  expect(academicRole(access('COURSE_PROFESSOR'))).toBe('TEACHER');
  expect(academicRole(access('TEACHING_ASSISTANT'))).toBe('STUDENT');
  expect(academicRole(access('OBSERVER'))).toBe('STUDENT');
  expect(academicRole({ name: 'Curso', positions: [] })).toBe('STUDENT');
});

it('collects every position the person holds in one course offering', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  const course = {
    codigo: 'CC3002',
    nombre: 'Metodologías de Diseño y Programación',
    ano: 2026,
    periodo: 2,
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: URL) =>
      Promise.resolve(
        mufasaResponse(
          url.toString().includes('cursos_dictados')
            ? [
                { ...course, seccion: '1', id_cargo: 1 },
                { ...course, seccion: '2', id_cargo: 2 },
                { ...course, ano: 2025, seccion: '1', id_cargo: 1 },
              ]
            : [],
        ),
      ),
    ),
  );

  const access = await getMufasaCourseAccess(user, identifier);

  expect(access).toEqual({
    name: 'Metodologías de Diseño y Programación',
    positions: ['COURSE_PROFESSOR', 'AUXILIARY_PROFESSOR'],
  });
  expect(canCreateRoadmap(access!)).toBe(true);
});

it('reports no access when U-Campus does not place the person in the offering', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mufasaResponse([])));

  await expect(getMufasaCourseAccess(user, identifier)).resolves.toBeNull();
});

it('reports no access while U-Campus is unreachable', async () => {
  process.env.MUFASA_TOKEN = 'private-token';
  process.env.MUFASA_BASE_URL = 'https://mufasa.example.test/api';
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));

  await expect(getMufasaCourseAccess(user, identifier)).resolves.toBeNull();
});
