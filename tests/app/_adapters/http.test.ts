// @vitest-environment node
import { redirect } from 'next/navigation';
import { NextResponse } from 'next/server';
import { afterEach, expect, test, vi } from 'vitest';
import { handleApplicationResult, courseRoute } from '@/app/_adapters/http';
import { ApplicationError } from '@/shared/errors/types';
import { Prisma } from '@/shared/server/db';

const { getApplicationSession, findUser } = vi.hoisted(() => ({
  getApplicationSession: vi.fn(),
  findUser: vi.fn(),
}));
vi.mock('@/shared/server/session', () => ({ getApplicationSession }));
vi.mock('@/shared/server/db', async () => {
  const { PrismaClientKnownRequestError } = await import('@prisma/client/runtime/client');
  return { Prisma: { PrismaClientKnownRequestError }, prisma: { user: { findUnique: findUser } } };
});

afterEach(() => vi.restoreAllMocks());

test('isolates database initialization while retaining the generated Prisma error identity', async () => {
  const generated = await vi.importActual<{ Prisma: typeof Prisma }>('@/generated/prisma/client');
  expect(Prisma.PrismaClientKnownRequestError).toBe(generated.Prisma.PrismaClientKnownRequestError);
});

test('preserves successful response status, headers and serialized content', async () => {
  const response = await handleApplicationResult(async () =>
    NextResponse.json(
      { title: 'Introducción' },
      { status: 201, headers: { 'x-result': 'created' } },
    ),
  );
  expect(response.status).toBe(201);
  expect(response.headers.get('x-result')).toBe('created');
  expect(response.headers.get('content-type')).toBe('application/json');
  await expect(response.json()).resolves.toEqual({ title: 'Introducción' });
});

const genericError = { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado.' };
const knownError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError('SECRET SQL SELECT password FROM users', {
    code,
    clientVersion: '7.9.1',
    meta: { secret: 'private metadata' },
  });

test.each([
  {
    name: 'ApplicationError details',
    failure: new ApplicationError(403, 'FORBIDDEN', 'Acceso denegado.', { nodeId: 'node-1' }),
    status: 403,
    error: { code: 'FORBIDDEN', message: 'Acceso denegado.', details: { nodeId: 'node-1' } },
    logs: false,
  },
  {
    name: 'P2025',
    failure: knownError('P2025'),
    status: 404,
    error: { code: 'NOT_FOUND', message: 'El recurso solicitado no existe.' },
    logs: false,
  },
  {
    name: 'P2003',
    failure: knownError('P2003'),
    status: 409,
    error: { code: 'CONFLICT', message: 'La operación entra en conflicto con datos relacionados.' },
    logs: false,
  },
  {
    name: 'P2002',
    failure: knownError('P2002'),
    status: 409,
    error: {
      code: 'CONFLICT',
      message: 'La operación entra en conflicto con un recurso existente.',
    },
    logs: false,
  },
  {
    name: 'P2034',
    failure: knownError('P2034'),
    status: 409,
    error: {
      code: 'CONFLICT',
      message: 'La operación entra en conflicto con un recurso existente.',
    },
    logs: false,
  },
  {
    name: 'unknown Prisma code',
    failure: knownError('P9999'),
    status: 500,
    error: genericError,
    logs: true,
  },
  {
    name: 'ordinary Error',
    failure: new Error('SECRET connection password'),
    status: 500,
    error: genericError,
    logs: true,
  },
  {
    name: 'non-Error value',
    failure: { sql: 'SECRET SELECT password', stack: 'private stack' },
    status: 500,
    error: genericError,
    logs: true,
  },
])(
  'normalizes $name through real synchronous and asynchronous failure paths',
  async ({ failure, status, error, logs }) => {
    if (logs) vi.spyOn(console, 'error').mockImplementation(() => undefined);
    for (const operation of [
      () => {
        throw failure;
      },
      () => Promise.reject(failure),
    ]) {
      const response = await handleApplicationResult(operation);
      expect(response.status).toBe(status);
      expect(response.headers.get('content-type')).toBe('application/json');
      await expect(response.json()).resolves.toEqual({ error });
    }
  },
);

test('propagates a real Next redirect instead of normalizing framework control flow', async () => {
  await expect(handleApplicationResult(async () => redirect('/login'))).rejects.toMatchObject({
    digest: 'NEXT_REDIRECT;replace;/login;307;',
  });
});

test.each([
  {
    name: 'unauthenticated User',
    session: null,
    courseCode: 'CC3002',
    body: '{}',
    status: 401,
    error: { code: 'UNAUTHENTICATED', message: 'Debes iniciar sesión para continuar.' },
  },
  {
    name: 'invalid Course offering identifier',
    session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    courseCode: '  ',
    body: '{}',
    status: 400,
    error: {
      code: 'INVALID_ACADEMIC_IDENTITY',
      message: 'El ramo, año y semestre no forman una identidad académica válida.',
    },
  },
  {
    name: 'malformed JSON',
    session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    courseCode: 'CC3002',
    body: '{',
    status: 400,
    error: { code: 'INVALID_JSON', message: 'El cuerpo debe ser JSON válido.' },
  },
  ...['[]', '"roadmap"', 'null'].map((body) => ({
    name: `non-object body ${body}`,
    session: { user: { id: '11111111-1111-4111-8111-111111111111' } },
    courseCode: 'CC3002',
    body,
    status: 400,
    error: { code: 'INVALID_REQUEST', message: 'El cuerpo debe ser un objeto JSON.' },
  })),
])(
  'refuses $name before invoking the domain operation',
  async ({ session, courseCode, body, status, error }) => {
    getApplicationSession.mockResolvedValue(session);
    findUser.mockResolvedValue({ id: '11111111-1111-4111-8111-111111111111' });
    const mutation = vi.fn(async () => Response.json({ saved: true }));
    const handler = courseRoute(mutation, { body: true });
    const response = await handler(
      new Request('http://localhost/api/roadmap', { method: 'POST', body }),
      {
        params: Promise.resolve({ courseCode, year: '2026', semester: '2' }),
      },
    );
    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual({ error });
    expect(mutation).not.toHaveBeenCalled();
  },
);
