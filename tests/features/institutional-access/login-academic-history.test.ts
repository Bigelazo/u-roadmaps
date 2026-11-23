// @vitest-environment node
import { afterEach, expect, test, vi } from 'vitest';
import { completeInstitutionalLogin } from '@/features/institutional-access/application/login';
import { createMufasaUCampus, forgetAcademicHistory } from '@/integrations/ucampus/server';

const rut = '10000000';

vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError } };
});

vi.mock('@/integrations/vti/server', async (original) => ({
  ...(await original<typeof import('@/integrations/vti/server')>()),
  authenticateVtiCallback: vi.fn(async () => ({
    rut,
    institutionalEmail: 'estudiante@ug.uchile.cl',
    name: 'Estudiante',
  })),
}));

vi.mock('@/features/institutional-access/infrastructure/user', () => ({
  InstitutionalIdentityConflict: class extends Error {},
  reconcileInstitutionalUser: vi.fn(async () => ({
    id: '6f9c1a52-5a49-4c55-9a1e-4f0f4f7f3b11',
    rut,
  })),
}));

vi.mock('@/features/institutional-access/infrastructure/session', () => ({
  applicationSessionCookie: () => ({ name: 'next-auth.session-token', path: '/' }),
  applicationSessionMaxAge: 3600,
  createApplicationSessionToken: vi.fn(async () => 'session-token'),
}));

afterEach(() => {
  forgetAcademicHistory(rut);
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

test('an institutional login asks MUFASA again for that User', async () => {
  vi.stubEnv('MUFASA_TOKEN', 'private-token');
  const fetch = vi.fn(async (url: URL) =>
    Response.json(
      url.pathname.endsWith('/cursos_inscritos')
        ? [{ codigo: 'CC5002', nombre: 'Desarrollo de software', ano: 2026, periodo: 2 }]
        : [],
    ),
  );
  vi.stubGlobal('fetch', fetch);
  const history = () =>
    createMufasaUCampus({ sharedAcademicHistory: true }).getAcademicHistory(rut);
  await history();
  await history();
  expect(fetch).toHaveBeenCalledTimes(2);

  const login = await completeInstitutionalLogin(
    new Request('http://localhost:3000/api/plogin', {
      headers: { cookie: 'u-roadmaps-vti-state=state' },
    }),
    'jwt',
  );

  expect(login.isOk()).toBe(true);
  await history();
  expect(fetch).toHaveBeenCalledTimes(4);
});
